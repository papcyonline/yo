const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;
const { contentModerationService } = require('../services/contentModerationService');

// Define schemas
const BlockedUserSchema = new mongoose.Schema({
  userId: { type: ObjectId, required: true, ref: 'User' },
  blockedUserId: { type: ObjectId, required: true, ref: 'User' },
  blockedUserName: { type: String, required: true },
  blockedUserPhoto: { type: String },
  reason: { type: String },
  blockedAt: { type: Date, default: Date.now }
});

const ReportSchema = new mongoose.Schema({
  reporterId: { type: ObjectId, required: true, ref: 'User' },
  reportedUserId: { type: ObjectId, required: true, ref: 'User' },
  reason: { 
    type: String, 
    enum: ['spam', 'harassment', 'inappropriate_content', 'fake_profile', 'other'],
    required: true 
  },
  description: { type: String, required: true },
  evidence: {
    messageId: { type: ObjectId },
    screenshot: { type: String }
  },
  status: { 
    type: String, 
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  },
  adminNotes: { type: String },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date }
});

// Create indexes for better performance
BlockedUserSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
BlockedUserSchema.index({ userId: 1 });
ReportSchema.index({ reporterId: 1 });
ReportSchema.index({ reportedUserId: 1 });
ReportSchema.index({ status: 1 });

// Check if models already exist to prevent OverwriteModelError
const BlockedUser = mongoose.models.BlockedUser || mongoose.model('BlockedUser', BlockedUserSchema);
const Report = mongoose.models.Report || mongoose.model('Report', ReportSchema);

// Middleware to require authentication
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  next();
};

// Block a user
router.post('/block', requireAuth, async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const blockerId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (userId === blockerId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    }

    // Get user info for the blocked user
    const User = mongoose.model('User');
    const blockedUser = await User.findById(userId).select('fullName username profile_photo_url');
    
    if (!blockedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Create blocked user record
    const blockedRecord = new BlockedUser({
      userId: blockerId,
      blockedUserId: userId,
      blockedUserName: blockedUser.fullName || blockedUser.username,
      blockedUserPhoto: blockedUser.profile_photo_url,
      reason
    });

    await blockedRecord.save();

    // Also remove any existing friend connections
    const Connection = mongoose.model('Connection');
    if (Connection) {
      await Connection.deleteMany({
        $or: [
          { requester: blockerId, recipient: userId },
          { requester: userId, recipient: blockerId }
        ]
      });
    }

    console.log(`✅ User ${blockerId} blocked user ${userId}`);

    res.json({
      success: true,
      message: 'User blocked successfully',
      data: {
        blockedUserId: userId,
        blockedUserName: blockedRecord.blockedUserName
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
router.delete('/block/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const unblockerId = req.user.id || req.user._id;

    const result = await BlockedUser.deleteOne({
      userId: unblockerId,
      blockedUserId: userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'User is not blocked' });
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
router.get('/blocked', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const blockedUsers = await BlockedUser.find({ userId })
      .sort({ blockedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        blockedUsers: blockedUsers.map(blocked => ({
          id: blocked._id,
          userId: blocked.userId,
          blockedUserId: blocked.blockedUserId,
          blockedUserName: blocked.blockedUserName,
          blockedUserPhoto: blocked.blockedUserPhoto,
          reason: blocked.reason,
          blockedAt: blocked.blockedAt
        }))
      }
    });

  } catch (error) {
    console.error('❌ Get blocked users error:', error);
    res.status(500).json({ success: false, message: 'Failed to get blocked users' });
  }
});

// Report a user
router.post('/report', requireAuth, async (req, res) => {
  try {
    const { reportedUserId, reason, description, evidence } = req.body;
    const reporterId = req.user.id || req.user._id;

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
    const User = mongoose.model('User');
    const reportedUser = await User.findById(reportedUserId);
    
    if (!reportedUser) {
      return res.status(404).json({ success: false, message: 'Reported user not found' });
    }

    // Create report
    const report = new Report({
      reporterId,
      reportedUserId,
      reason,
      description: description.trim(),
      evidence
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
router.get('/is-blocked/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const checkerId = req.user.id || req.user._id;

    const isBlocked = await BlockedUser.findOne({
      userId: checkerId,
      blockedUserId: userId
    });

    res.json({
      success: true,
      data: {
        isBlocked: !!isBlocked,
        blockedAt: isBlocked ? isBlocked.blockedAt : null
      }
    });

  } catch (error) {
    console.error('❌ Check blocked status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check blocked status' });
  }
});

// Get blocking statistics (for user)
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const [blockedCount, reportsSubmitted] = await Promise.all([
      BlockedUser.countDocuments({ userId }),
      Report.countDocuments({ reporterId: userId })
    ]);

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
      userId,
      blockedUserId: { $in: userIds }
    }).distinct('blockedUserId');
    
    return userIds.filter(id => !blockedUsers.some(blocked => blocked.toString() === id.toString()));
  } catch (error) {
    console.error('❌ Filter blocked users error:', error);
    return userIds; // Return original list if filtering fails
  }
};

// ==================== CONTENT MODERATION ENDPOINTS ====================

// Get content moderation statistics (admin)
router.get('/moderation/stats', requireAuth, async (req, res) => {
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
router.post('/moderation/test', requireAuth, async (req, res) => {
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
router.post('/moderation/toggle', requireAuth, async (req, res) => {
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
router.post('/moderation/profanity', requireAuth, async (req, res) => {
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
router.delete('/moderation/profanity/:word', requireAuth, async (req, res) => {
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