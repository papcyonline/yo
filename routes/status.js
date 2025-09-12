const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Status = require('../models/Status');
const authMiddleware = require('../middleware/auth');
const { contentModerationService } = require('../services/contentModerationService');

const router = express.Router();

// Configure temporary storage for status images (24hr expiry)
const path = require('path');
const fs = require('fs').promises;

// Create temp directory for status images
const tempStatusDir = path.join(__dirname, '..', 'temp', 'status_images');
fs.mkdir(tempStatusDir, { recursive: true }).catch(console.error);

const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempStatusDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp for auto-cleanup
    const timestamp = Date.now();
    const uniqueSuffix = Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `status_${timestamp}_${uniqueSuffix}${extension}`);
  }
});

// Configure Cloudinary storage for multer - Audio
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'status_audio',
    allowed_formats: ['mp3', 'm4a', 'wav', 'aac'],
    resource_type: 'video', // Cloudinary treats audio as video resource type
  },
});

// Configure multer to handle both image and audio
const uploadFields = multer({
  storage: multer.memoryStorage(), // Use memory storage for custom handling
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]);

const upload = multer({ 
  storage: tempStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for high quality images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Test endpoint to debug FormData
router.post('/debug', authMiddleware, upload.single('image'), async (req, res) => {
  console.log('🔍 [DEBUG ENDPOINT] Full request body:', req.body);
  console.log('🔍 [DEBUG ENDPOINT] File:', req.file);
  console.log('🔍 [DEBUG ENDPOINT] Headers:', req.headers);
  
  res.json({
    success: true,
    body: req.body,
    file: req.file ? 'FILE_RECEIVED' : 'NO_FILE',
    headers: Object.keys(req.headers)
  });
});

// Create a new status
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { text, visibility, location_name, latitude, longitude, textBackgroundColor, textFontSize, textColor, textFontFamily, textAlignment } = req.body;

    console.log('📝 Creating status for user:', req.userId);
    console.log('📝 Status data:', { text: text?.substring(0, 50), visibility, location_name });
    console.log('📝 [DEBUG] Received text:', text);
    console.log('📝 [DEBUG] Received file:', req.file ? 'YES' : 'NO');
    console.log('📝 [DEBUG] req.file details:', req.file);
    console.log('📝 [DEBUG] req.body keys:', Object.keys(req.body));
    console.log('📝 [DEBUG] req.body.image type:', typeof req.body.image);
    console.log('📝 [DEBUG] req.body.image value:', req.body.image);
    console.log('📝 [DEBUG] req.files:', req.files);
    console.log('📝 [DEBUG] Text validation:', { 
      hasText: !!text?.trim(), 
      textLength: text?.length, 
      trimmedLength: text?.trim()?.length 
    });
    
    console.log('🎨 [DEBUG] Style data received:', {
      backgroundColor: textBackgroundColor,
      textColor: textColor,
      fontSize: textFontSize,
      fontFamily: textFontFamily,
      alignment: textAlignment
    });

    // Check for uploaded file
    const imageFile = req.file;
    
    console.log('📝 [DEBUG] Files received:', {
      image: imageFile ? 'YES' : 'NO',
      imageFile: imageFile ? imageFile.originalname : null,
      imageUrl: imageFile ? imageFile.path : null
    });
    
    // Validate required content  
    if (!text?.trim() && !imageFile) {
      console.log('📝 [ERROR] Validation failed - no text or image');
      return res.status(400).json({
        success: false,
        message: 'Please provide text or image'
      });
    }

    // Content moderation for text content
    let moderatedText = text?.trim() || '';
    if (moderatedText) {
      console.log(`🔍 Moderating status text from user ${req.userId}...`);
      
      const moderationResult = await contentModerationService.moderatePost({
        content: moderatedText,
        userId: req.userId
      });

      if (!moderationResult.overallApproved) {
        console.log(`🚫 Status blocked due to policy violations`);
        
        return res.status(400).json({
          success: false,
          message: 'Your status contains content that violates our community guidelines. Please review and try again.',
          violations: moderationResult.content.flags || []
        });
      }

      // Use cleaned content if available
      if (moderationResult.content.modifiedContent !== moderatedText) {
        moderatedText = moderationResult.content.modifiedContent;
        console.log(`🧼 Status content filtered`);
      }
    }

    // Determine content type
    let contentType = 'text';
    if (imageFile) {
      contentType = moderatedText ? 'text_with_image' : 'image';
    }

    // Prepare status data
    const statusData = {
      user_id: req.userId,
      content: {
        text: moderatedText,
        type: contentType,
        style: {
          background_color: textBackgroundColor || '#04a7c7',
          font_size: textFontSize ? parseInt(textFontSize) : 18,
          text_color: textColor || '#FFFFFF',
          font_family: textFontFamily || 'System',
          text_alignment: textAlignment || 'center'
        }
      },
      visibility: visibility || 'friends',
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // Explicitly set 24 hour expiry
    };

    // Add media if image uploaded  
    if (imageFile) {
      // Create URL for serving the temporary file
      const imageUrl = `${req.protocol}://${req.get('host')}/temp/status_images/${imageFile.filename}`;
      
      statusData.media = {
        image_url: imageUrl,
        image_public_id: imageFile.filename,
        thumbnail_url: imageUrl, // Same original image - no processing needed
        file_path: imageFile.path, // Store local path for cleanup
        created_at: new Date() // For cleanup scheduling
      };
      
      console.log('🖼️ [SUCCESS] Image stored temporarily:', imageUrl);
    }

    // Add location if provided
    if (location_name || (latitude && longitude)) {
      statusData.location = {
        name: location_name,
        coordinates: {
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        }
      };
    }

    const status = new Status(statusData);
    const savedStatus = await status.save();
    
    // Populate user data for response
    await savedStatus.populate('user_id', 'first_name last_name profile_photo_url');

    console.log('✅ Status created successfully:', savedStatus._id);

    // Emit real-time update if socket.io is available
    if (req.app.locals.io) {
      req.app.locals.io.to('status_feed').emit('new_status', savedStatus);
      req.app.locals.io.to(`user_${req.userId}`).emit('status_created', savedStatus);
    }

    res.status(201).json({
      success: true,
      message: 'Status created successfully',
      data: {
        status: savedStatus
      }
    });

  } catch (error) {
    console.error('❌ Error creating status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create status'
    });
  }
});

// Get status feed
router.get('/feed', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    console.log('📱 Getting status feed for user:', req.userId);

    const query = {
      is_active: true,
      expires_at: { $gt: new Date() }
    };
    
    console.log('📱 [DEBUG] Query:', query, 'Current time:', new Date());

    const statuses = await Status.find(query)
    .populate('user_id', 'first_name last_name profile_photo_url')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);
    
    console.log('📱 [DEBUG] Retrieved statuses:', statuses.map(s => ({
      id: s._id,
      contentType: s.content.type,
      hasMedia: !!s.media,
      imageUrl: s.media?.image_url,
      userName: s.user_id.first_name,
      createdAt: s.created_at,
      expiresAt: s.expires_at,
      isActive: s.is_active,
      text: s.content.text?.substring(0, 30),
      fullContent: s.content,
      fullMedia: s.media
    })));

    // Let's check if there are any text-only statuses being filtered out
    const allStatuses = await Status.find({})
      .populate('user_id', 'first_name last_name profile_photo_url')
      .sort({ created_at: -1 })
      .limit(20);
    
    console.log('🔍 [DEBUG] ALL statuses in database (recent 20):', allStatuses.map(s => ({
      id: s._id,
      contentType: s.content.type,
      text: s.content.text?.substring(0, 30),
      hasMedia: !!s.media,
      isActive: s.is_active,
      expires: s.expires_at,
      expired: new Date() > s.expires_at
    })));

    // Also check if there are ANY statuses in the database
    const totalStatuses = await Status.countDocuments({});
    const activeStatuses = await Status.countDocuments({ is_active: true });
    const unexpiredStatuses = await Status.countDocuments({ expires_at: { $gt: new Date() } });
    
    console.log('📱 [DEBUG] Status counts:', {
      total: totalStatuses,
      active: activeStatuses,
      unexpired: unexpiredStatuses,
      matchingQuery: statuses.length
    });

    res.json({
      success: true,
      data: {
        statuses,
        count: statuses.length,
        hasMore: statuses.length >= limit
      }
    });

  } catch (error) {
    console.error('❌ Error getting status feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load status feed'
    });
  }
});

// Get current user's statuses (main route)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    console.log('📱 Getting current user statuses for user:', req.userId);

    const statuses = await Status.find({
      user_id: req.userId,
      is_active: true
    })
    .populate('user_id', 'first_name last_name profile_photo_url')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);

    res.json({
      success: true,
      data: {
        statuses,
        count: statuses.length,
        hasMore: statuses.length >= limit
      }
    });

  } catch (error) {
    console.error('❌ Error getting user statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load your statuses'
    });
  }
});

// Get my statuses (alternative route)
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    console.log('📱 Getting my statuses for user:', req.userId);

    const statuses = await Status.find({
      user_id: req.userId,
      is_active: true
    })
    .populate('user_id', 'first_name last_name profile_photo_url')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);

    res.json({
      success: true,
      statuses
    });

  } catch (error) {
    console.error('❌ Error getting my statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load your statuses'
    });
  }
});

// Delete a status
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    // Check ownership
    if (status.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this status'
      });
    }

    // Delete image from Cloudinary if exists
    if (status.media?.image_public_id) {
      try {
        await cloudinary.uploader.destroy(status.media.image_public_id);
        console.log('🗑️ Deleted image from Cloudinary:', status.media.image_public_id);
      } catch (cloudinaryError) {
        console.warn('⚠️ Failed to delete image from Cloudinary:', cloudinaryError);
      }
    }

    await Status.findByIdAndDelete(req.params.id);
    console.log('✅ Status deleted successfully:', req.params.id);

    // Emit real-time update
    if (req.app.locals.io) {
      req.app.locals.io.to('status_feed').emit('status_deleted', req.params.id);
      req.app.locals.io.to(`user_${req.userId}`).emit('status_deleted', req.params.id);
    }

    res.json({
      success: true,
      message: 'Status deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete status'
    });
  }
});

// Like a status
router.post('/:id/like', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    await status.addLike(req.userId);
    console.log('👍 Status liked by user:', req.userId);

    // Emit real-time update
    if (req.app.locals.io) {
      req.app.locals.io.to('status_feed').emit('status_liked', {
        statusId: req.params.id,
        userId: req.userId,
        likeCount: status.likeCount
      });
      
      // Notify status owner
      if (status.user_id.toString() !== req.userId) {
        req.app.locals.io.to(`user_${status.user_id}`).emit('status_interaction', {
          type: 'like',
          statusId: req.params.id,
          userId: req.userId
        });
      }
    }

    res.json({
      success: true,
      message: 'Status liked successfully'
    });

  } catch (error) {
    console.error('❌ Error liking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like status'
    });
  }
});

// Unlike a status
router.delete('/:id/like', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    await status.removeLike(req.userId);
    console.log('👎 Status unliked by user:', req.userId);

    // Emit real-time update
    if (req.app.locals.io) {
      req.app.locals.io.to('status_feed').emit('status_unliked', {
        statusId: req.params.id,
        userId: req.userId,
        likeCount: status.likeCount
      });
    }

    res.json({
      success: true,
      message: 'Status unliked successfully'
    });

  } catch (error) {
    console.error('❌ Error unliking status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike status'
    });
  }
});

// Record a view
router.post('/:id/view', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    // Don't record views for own status
    if (status.user_id.toString() !== req.userId) {
      await status.incrementViews(req.userId);
      console.log('👁️ Status viewed by user:', req.userId);

      // Emit real-time update to status owner
      if (req.app.locals.io) {
        req.app.locals.io.to(`user_${status.user_id}`).emit('status_viewed', {
          statusId: req.params.id,
          viewerId: req.userId,
          viewCount: status.engagement.views,
          totalViewers: status.engagement.viewers.length
        });
      }
    }

    res.json({
      success: true,
      message: 'View recorded',
      data: {
        viewCount: status.engagement.views,
        viewerCount: status.engagement.viewers.length
      }
    });

  } catch (error) {
    console.error('❌ Error recording view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record view'
    });
  }
});

// Get status viewers
router.get('/:id/viewers', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id)
      .populate('engagement.viewers.user_id', 'first_name last_name profile_photo_url');

    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    // Only status owner can see viewers
    if (status.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this information'
      });
    }

    res.json({
      success: true,
      data: {
        viewers: status.engagement.viewers,
        totalViews: status.engagement.views,
        totalViewers: status.engagement.viewers.length
      }
    });

  } catch (error) {
    console.error('❌ Error getting viewers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get viewers'
    });
  }
});

// Delete a status
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }
    
    // Only status owner can delete
    if (status.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this status'
      });
    }
    
    // Delete the status
    await Status.findByIdAndDelete(req.params.id);
    
    console.log(`✅ Status ${req.params.id} deleted by user ${req.userId}`);
    
    res.json({
      success: true,
      message: 'Status deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete status'
    });
  }
});

// Cleanup function for expired status images (like WhatsApp - 24hrs)
async function cleanupExpiredStatusImages() {
  try {
    const Status = require('../models/Status');
    const now = new Date();
    
    console.log('🧹 [CLEANUP] Starting cleanup of expired status images...');
    
    // Find statuses with images that have expired based on expires_at field
    const expiredStatuses = await Status.find({
      'media.file_path': { $exists: true },
      expires_at: { $lt: now }
    });
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const status of expiredStatuses) {
      if (status.media && status.media.file_path) {
        try {
          // Check if file exists before trying to delete
          const fs = require('fs').promises;
          await fs.access(status.media.file_path);
          
          // Delete the physical file
          await fs.unlink(status.media.file_path);
          console.log('🗑️ [CLEANUP] Deleted expired status image:', status.media.file_path);
          deletedCount++;
          
          // Remove file references from database but keep status record
          status.media.file_path = undefined;
          status.media.image_url = undefined;
          status.media.thumbnail_url = undefined;
          await status.save();
          
        } catch (fileError) {
          if (fileError.code === 'ENOENT') {
            console.log('ℹ️ [CLEANUP] File already deleted:', status.media.file_path);
            // Still update the database to remove the reference
            status.media.file_path = undefined;
            status.media.image_url = undefined;
            status.media.thumbnail_url = undefined;
            await status.save();
          } else {
            console.log('⚠️ [CLEANUP] Error deleting file:', status.media.file_path, fileError.message);
            errorCount++;
          }
        }
      }
    }
    
    // Also clean up orphaned files in temp directory
    await cleanupOrphanedTempFiles();
    
    console.log(`🧹 [CLEANUP] Processed ${expiredStatuses.length} expired statuses, deleted ${deletedCount} files, ${errorCount} errors`);
  } catch (error) {
    console.error('❌ [CLEANUP] Error during cleanup process:', error);
  }
}

// Function to clean up orphaned files in temp directory
async function cleanupOrphanedTempFiles() {
  try {
    const tempDir = path.join(__dirname, '..', 'temp', 'status_images');
    const fs = require('fs').promises;
    
    // Check if temp directory exists
    try {
      await fs.access(tempDir);
    } catch {
      return; // Directory doesn't exist, nothing to clean
    }
    
    const files = await fs.readdir(tempDir);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let orphanedCount = 0;
    
    for (const filename of files) {
      const filePath = path.join(tempDir, filename);
      
      try {
        const stats = await fs.stat(filePath);
        
        // If file is older than 24 hours, check if it's still referenced in database
        if (stats.mtime < twentyFourHoursAgo) {
          const Status = require('../models/Status');
          const referencedStatus = await Status.findOne({ 'media.file_path': filePath });
          
          if (!referencedStatus) {
            // File is orphaned, delete it
            await fs.unlink(filePath);
            console.log('🗑️ [CLEANUP] Deleted orphaned file:', filename);
            orphanedCount++;
          }
        }
      } catch (fileError) {
        console.log('⚠️ [CLEANUP] Error processing file:', filename, fileError.message);
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`🧹 [CLEANUP] Deleted ${orphanedCount} orphaned files`);
    }
  } catch (error) {
    console.log('⚠️ [CLEANUP] Error cleaning orphaned files:', error.message);
  }
}

// NOTE: Cleanup is now handled by the centralized CleanupService in server.js
// This provides better scheduling, error handling, and logging

module.exports = router;