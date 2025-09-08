const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Status = require('../models/Status');
const authMiddleware = require('../middleware/auth');
const { contentModerationService } = require('../services/contentModerationService');

const router = express.Router();

// Configure Cloudinary storage for multer - Images
const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'status_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good' },
      { width: 300, height: 300, crop: 'fill', quality: 'auto:low', suffix: '_thumb' }
    ]
  },
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

const upload = multer({ storage: imageStorage });

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
router.post('/', authMiddleware, uploadFields, async (req, res) => {
  try {
    const { text, visibility, location_name, latitude, longitude, textBackgroundColor, textFontSize } = req.body;

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

    // Check for uploaded files
    const imageFile = req.files?.image?.[0];
    const audioFile = req.files?.audio?.[0];
    
    console.log('📝 [DEBUG] Files received:', {
      image: imageFile ? 'YES' : 'NO',
      audio: audioFile ? 'YES' : 'NO',
      imageFile: imageFile ? imageFile.originalname : null,
      audioFile: audioFile ? audioFile.originalname : null
    });
    
    // Validate required content  
    if (!text?.trim() && !imageFile && !audioFile) {
      console.log('📝 [ERROR] Validation failed - no text, image, or audio');
      return res.status(400).json({
        success: false,
        message: 'Please provide text, image, or audio'
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
    if (imageFile && audioFile) {
      contentType = moderatedText ? 'text_with_image_audio' : 'image_audio';
    } else if (imageFile) {
      contentType = moderatedText ? 'text_with_image' : 'image';
    } else if (audioFile) {
      contentType = moderatedText ? 'text_with_audio' : 'audio';
    }

    // Prepare status data
    const statusData = {
      user_id: req.userId,
      content: {
        text: moderatedText,
        type: contentType,
        style: {
          background_color: textBackgroundColor || '#0091ad',
          font_size: textFontSize ? parseInt(textFontSize) : 18
        }
      },
      visibility: visibility || 'friends',
      is_active: true
    };

    // Upload files to Cloudinary and add media data
    if (imageFile || audioFile) {
      statusData.media = {};

      // Handle image upload
      if (imageFile) {
        try {
          const imageUploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                folder: 'status_images',
                transformation: [
                  { width: 800, height: 800, crop: 'limit', quality: 'auto:good' },
                ],
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(imageFile.buffer);
          });

          statusData.media.image_url = imageUploadResult.secure_url;
          statusData.media.image_public_id = imageUploadResult.public_id;
          statusData.media.thumbnail_url = imageUploadResult.secure_url.replace('/upload/', '/upload/c_fill,h_300,w_300,q_auto:low/');
          
          console.log('🖼️ [SUCCESS] Image uploaded to Cloudinary:', imageUploadResult.secure_url);
        } catch (error) {
          console.error('🖼️ [ERROR] Image upload failed:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload image'
          });
        }
      }

      // Handle audio upload
      if (audioFile) {
        try {
          const audioUploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              {
                folder: 'status_audio',
                resource_type: 'video', // Cloudinary uses 'video' for audio
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result);
              }
            ).end(audioFile.buffer);
          });

          statusData.media.audio_url = audioUploadResult.secure_url;
          statusData.media.audio_public_id = audioUploadResult.public_id;
          statusData.media.audio_duration = audioUploadResult.duration;
          
          console.log('🎤 [SUCCESS] Audio uploaded to Cloudinary:', audioUploadResult.secure_url);
        } catch (error) {
          console.error('🎤 [ERROR] Audio upload failed:', error);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload audio'
          });
        }
      }
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

    const statuses = await Status.find({
      is_active: true,
      expires_at: { $gt: new Date() }
    })
    .populate('user_id', 'first_name last_name profile_photo_url')
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);
    
    console.log('📱 [DEBUG] Retrieved statuses with media:', statuses.map(s => ({
      id: s._id,
      contentType: s.content.type,
      hasMedia: !!s.media,
      imageUrl: s.media?.image_url,
      userName: s.user_id.first_name
    })));

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

module.exports = router;