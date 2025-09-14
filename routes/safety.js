const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { contentModerationService } = require('../services/contentModerationService');
const authMiddleware = require('../middleware/auth');
const { BlockedUser, Report, User } = require('../models');

// Report schema is already defined in models/Report.js

// Models are imported from ../models

// Using the standard auth middleware

// Block a user
router.post('/block', authMiddleware, async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const blockerId = req.user._id;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (userId === blockerId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    }

    // Get user info for the blocked user
    const blockedUser = await User.findById(userId).select('first_name last_name username profile_picture_url');

    if (!blockedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Use the BlockedUser model's static method
    const blockedRecord = await BlockedUser.blockUser(blockerId, userId, reason, '');

    // Remove any existing friend connections
    const { FriendRequest } = require('../models');
    await FriendRequest.deleteMany({
      $or: [
        { sender_id: blockerId, receiver_id: userId },
        { sender_id: userId, receiver_id: blockerId }
      ]
    });

    console.log(`✅ User ${blockerId} blocked user ${userId}`);

    res.json({
      success: true,
      message: 'User blocked successfully',
      data: {
        blockedUserId: userId,
        blockedUserName: `${blockedUser.first_name} ${blockedUser.last_name}`.trim() || blockedUser.username
      }
    });

  } catch (error) {
    console.error('❌ Block user error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'User is already blocked' });
    }
    
    res.status(500).json({ success: false, message: 'Failed to block user' });
  }
});

// Unblock a user
router.delete('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const unblockerId = req.user._id;

    try {
      await BlockedUser.unblockUser(unblockerId, userId);
    } catch (error) {
      if (error.message === 'User is not blocked') {
        return res.status(404).json({ success: false, message: 'User is not blocked' });
      }
      throw error;
    }

    console.log(`✅ User ${unblockerId} unblocked user ${userId}`);

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });

  } catch (error) {
    console.error('❌ Unblock user error:', error);
    res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
});

// Get blocked users
router.get('/blocked', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const blockedUsers = await BlockedUser.getBlockedUsers(userId);

    res.json({
      success: true,
      data: {
        blockedUsers: blockedUsers.map(blocked => ({
          id: blocked._id,
          userId: blocked.blocker,
          blockedUserId: blocked.blocked._id,
          blockedUserName: `${blocked.blocked.first_name} ${blocked.blocked.last_name}`.trim() || blocked.blocked.username,
          blockedUserPhoto: blocked.blocked.profilePictureUrl,
          reason: blocked.reason,
          blockedAt: blocked.createdAt
        }))
      }
    });

  } catch (error) {
    console.error('❌ Get blocked users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get blocked users' });
  }
});

// Report a user
router.post('/report', authMiddleware, async (req, res) => {
  try {
    const { reportedUserId, reason, description, evidence } = req.body;
    const reporterId = req.user._id;

    if (!reportedUserId || !reason || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reported user ID, reason, and description are required' 
      });
    }

    if (reportedUserId === reporterId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot report yourself' });
    }

    // Verify reported user exists
    const reportedUser = await User.findById(reportedUserId);
    
    if (!reportedUser) {
      return res.status(404).json({ success: false, message: 'Reported user not found' });
    }

    // Create report
    const report = new Report({
      reporter: reporterId,
      reported: reportedUserId,
      type: reason,
      description: description.trim(),
      evidence: evidence ? [evidence] : []
    });

    await report.save();

    console.log(`📋 User ${reporterId} reported user ${reportedUserId} for ${reason}`);

    // TODO: Send notification to moderation team
    // TODO: Auto-action for severe reports (e.g., multiple harassment reports)

    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        reportId: report._id
      }
    });

  } catch (error) {
    console.error('❌ Report user error:', error);
    res.status(500).json({ success: false, message: 'Failed to submit report' });
  }
});

// Check if user is blocked (utility endpoint)
router.get('/is-blocked/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const checkerId = req.user._id;

    const isBlocked = await BlockedUser.isBlocked(checkerId, userId);

    res.json({
      success: true,
      data: {
        isBlocked: isBlocked
      }
    });

  } catch (error) {
    console.error('❌ Check blocked status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check blocked status' });
  }
});

// Get blocking statistics (for user)
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;

    const [blockedUsers, reportsSubmitted] = await Promise.all([
      BlockedUser.getBlockedUsers(userId),
      Report.countDocuments({ reporter: userId })
    });

    const blockedCount = blockedUsers.length;

    res.json({
      success: true,
      data: {
        blockedUsersCount: blockedCount,
        reportsSubmitted
      }
    });

  } catch (error) {
    console.error('❌ Get safety stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get safety statistics' });
  }
});

// Middleware to filter blocked users from results
const filterBlockedUsers = async (userId, userIds) => {
  try {
    const blockedUsers = await BlockedUser.find({
      blocker: userId,
      blocked: { $in: userIds },
      isActive: true
    }).distinct('blocked');

    return userIds.filter(id => !blockedUsers.some(blocked => blocked.toString() === id.toString()));
  } catch (error) {
    console.error('❌ Filter blocked users error:', error);
    return userIds; // Return original list if filtering fails
  }
};

// ==================== CONTENT MODERATION ENDPOINTS ====================

// Get content moderation statistics (admin)
router.get('/moderation/stats', authMiddleware, async (req, res) => {
  try {
    const stats = contentModerationService.getModerationStats();
    
    // Get user moderation stats if user ID provided
    const userId = req.query.userId;
    let userStats = null;
    if (userId) {
      userStats = await contentModerationService.getUserModerationStats(userId);
    }

    res.json({
      success: true,
      data: {
        systemStats: stats,
        userStats: userStats
      }
    });

  } catch (error) {
    console.error('Error getting moderation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get moderation stats'
    });
  }
});

// Test content moderation
router.post('/moderation/test', authMiddleware, async (req, res) => {
  try {
    const { content, contentType = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required for testing'
      });
    }

    const result = await contentModerationService.moderateContent(content, contentType, req.userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error testing content moderation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test content moderation'
    });
  }
});

// Enable/disable content moderation (admin only)
router.post('/moderation/toggle', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const { enabled } = req.body;

    contentModerationService.setModerationEnabled(enabled);

    res.json({
      success: true,
      message: `Content moderation ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        enabled: enabled
      }
    });

  } catch (error) {
    console.error('Error toggling content moderation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle content moderation'
    });
  }
});

// Add profanity word (admin only)
router.post('/moderation/profanity', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const { word } = req.body;

    if (!word || typeof word !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Word is required and must be a string'
      });
    }

    contentModerationService.addProfanityWord(word);

    res.json({
      success: true,
      message: 'Profanity word added successfully'
    });

  } catch (error) {
    console.error('Error adding profanity word:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add profanity word'
    });
  }
});

// Remove profanity word (admin only)
router.delete('/moderation/profanity/:word', authMiddleware, async (req, res) => {
  try {
    // TODO: Add admin role check here
    const { word } = req.params;

    contentModerationService.removeProfanityWord(word);

    res.json({
      success: true,
      message: 'Profanity word removed successfully'
    });

  } catch (error) {
    console.error('Error removing profanity word:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove profanity word'
    });
  }
});

// Export utility functions
router.filterBlockedUsers = filterBlockedUsers;
router.BlockedUser = BlockedUser;
router.Report = Report;

module.exports = router;