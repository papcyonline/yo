const express = require('express');
const mongoose = require('mongoose');
const Status = require('../../models/Status');
const router = express.Router();

// Create status
router.post('/', async (req, res) => {
  try {
    const { text, visibility, location_name, latitude, longitude } = req.body;

    if (!text?.trim() && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide text or image'
      });
    }

    // Validate visibility
    const validVisibilities = ['public', 'friends', 'family', 'private'];
    if (visibility && !validVisibilities.includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid visibility option'
      });
    }

    const statusData = {
      user_id: req.userId,
      content: {
        text: text?.trim(),
        type: 'text'
      },
      visibility: visibility || 'friends'
    };

    if (location_name || latitude || longitude) {
      statusData.location = {
        name: location_name,
        coordinates: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        }
      };
    }

    const status = new Status(statusData);
    const savedStatus = await status.save();

    res.status(201).json({
      success: true,
      status: savedStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get status feed
router.get('/feed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const statuses = await Status.find()
      .populate('user_id', 'first_name last_name profile_photo_url')
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(offset);

    res.json({
      success: true,
      statuses,
      pagination: { limit, offset }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Get my statuses
router.get('/my', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const statuses = await Status.find({ user_id: req.userId })
      .populate('user_id', 'first_name last_name profile_photo_url')
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(offset);

    res.json({
      success: true,
      statuses
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Delete status
router.delete('/:id', async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    if (status.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this status'
      });
    }

    await Status.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Status deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Like status
router.post('/:id/like', async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    await status.addLike(req.userId);

    res.json({
      success: true,
      message: 'Status liked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Unlike status
router.delete('/:id/like', async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    await status.removeLike(req.userId);

    res.json({
      success: true,
      message: 'Status unliked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// View status
router.post('/:id/view', async (req, res) => {
  try {
    const status = await Status.findById(req.params.id);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'Status not found'
      });
    }

    await status.incrementViews();

    res.json({
      success: true,
      message: 'View recorded'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;