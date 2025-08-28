const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const Status = require('../models/Status');
const authMiddleware = require('../middleware/auth');
const { contentModerationService } = require('../services/contentModerationService');

const router = express.Router();

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'status_images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good' },
      { width: 300, height: 300, crop: 'fill', quality: 'auto:low', suffix: '_thumb' }
    ]
  },
});

const upload = multer({ storage: storage });

// Create a new status
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    const { text, visibility, location_name, latitude, longitude } = req.body;

    console.log('📝 Creating status for user:', req.userId);
    console.log('📝 Status data:', { text: text?.substring(0, 50), visibility, location_name });

    // Validate required content
    if (!text?.trim() && !req.file) {
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

    // Prepare status data
    const statusData = {
      user_id: req.userId,
      content: {
        text: moderatedText,
        type: req.file ? (moderatedText ? 'text_with_image' : 'image') : 'text'
      },
      visibility: visibility || 'friends',
      is_active: true
    };

    // Add media if image uploaded
    if (req.file) {
      statusData.media = {
        image_url: req.file.path,
        image_public_id: req.file.filename,
        thumbnail_url: req.file.path.replace('/upload/', '/upload/c_fill,h_300,w_300,q_auto:low/')
      };
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
      status: savedStatus
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

    await status.incrementViews();
    console.log('👁️ Status viewed by user:', req.userId);

    // Emit real-time update to status owner
    if (req.app.locals.io && status.user_id.toString() !== req.userId) {
      req.app.locals.io.to(`user_${status.user_id}`).emit('status_viewed', {
        statusId: req.params.id,
        viewerId: req.userId,
        viewCount: status.engagement.views
      });
    }

    res.json({
      success: true,
      message: 'View recorded'
    });

  } catch (error) {
    console.error('❌ Error recording view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record view'
    });
  }
});

module.exports = router;