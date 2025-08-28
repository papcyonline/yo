const { Notification, User } = require('../models');

class NotificationService {
  /**
   * Check for high matches and send notifications on login
   */
  static async checkAndSendHighMatchNotifications(userId) {
    try {
      // Get user's recent matches
      const user = await User.findById(userId).select('ai_matches');
      if (!user || !user.ai_matches) return;

      // Filter for high confidence matches (65%+)
      const highMatches = user.ai_matches.filter(match => {
        // Convert confidence to percentage if needed
        let confidence = match.confidence;
        if (typeof confidence === 'string') {
          if (confidence === 'high') confidence = 0.8;
          else if (confidence === 'medium') confidence = 0.5;
          else if (confidence === 'low') confidence = 0.3;
          else confidence = parseFloat(confidence) || 0;
        }
        return confidence >= 0.65;
      });

      // Check if we've already sent notifications for these matches
      const existingNotifications = await Notification.find({
        user_id: userId,
        type: { $in: ['high_match', 'new_match'] },
        'data.match_id': { $in: highMatches.map(m => m.userId.toString()) }
      });

      const notifiedMatchIds = new Set(existingNotifications.map(n => n.data.match_id));

      // Send notifications for new high matches
      for (const match of highMatches) {
        const matchIdStr = match.userId.toString();
        if (!notifiedMatchIds.has(matchIdStr)) {
          // Get matched user details
          const matchedUser = await User.findById(match.userId).select('first_name last_name');
          if (matchedUser) {
            await Notification.createHighMatchNotification(userId, {
              userId: matchIdStr,
              name: `${matchedUser.first_name} ${matchedUser.last_name}`,
              score: match.confidence,
              type: match.type,
              reason: match.reasoning || match.matchDetails?.join(', '),
              predictedRelationship: match.predictedRelationship
            });
          }
        }
      }

      console.log(`✅ Checked high matches for user ${userId}: ${highMatches.length} high matches found`);
    } catch (error) {
      console.error('Error checking high match notifications:', error);
    }
  }

  /**
   * Send notification when a new chat message is received
   */
  static async sendNewMessageNotification(recipientId, messageData) {
    try {
      await Notification.createMessageNotification(recipientId, messageData);
      console.log(`📬 Message notification sent to user ${recipientId}`);
    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  }

  /**
   * Send notification when a new chat is started
   */
  static async sendNewChatNotification(recipientId, chatData) {
    try {
      await Notification.createNewChatNotification(recipientId, chatData);
      console.log(`💬 New chat notification sent to user ${recipientId}`);
    } catch (error) {
      console.error('Error sending new chat notification:', error);
    }
  }

  /**
   * Send notification for community matches
   */
  static async sendCommunityMatchNotification(userId, communityData) {
    try {
      await Notification.createCommunityMatchNotification(userId, communityData);
      console.log(`🌍 Community match notification sent to user ${userId}`);
    } catch (error) {
      console.error('Error sending community match notification:', error);
    }
  }

  /**
   * Send notification for friend requests
   */
  static async sendFriendRequestNotification(recipientId, requestData) {
    try {
      await Notification.createFriendRequestNotification(recipientId, requestData);
      console.log(`👋 Friend request notification sent to user ${recipientId}`);
    } catch (error) {
      console.error('Error sending friend request notification:', error);
    }
  }

  /**
   * Get all notifications for a user
   */
  static async getUserNotifications(userId, options = {}) {
    const { limit = 50, skip = 0, unreadOnly = false } = options;
    
    const query = {
      user_id: userId,
      expires_at: { $gt: new Date() }
    };

    if (unreadOnly) {
      query.read = false;
    }

    return await Notification.find(query)
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip);
  }

  /**
   * Mark notifications as read
   */
  static async markAsRead(notificationIds, userId) {
    return await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        user_id: userId
      },
      { read: true }
    );
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    return await Notification.updateMany(
      { user_id: userId, read: false },
      { read: true }
    );
  }

  /**
   * Delete old notifications
   */
  static async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      created_at: { $lt: thirtyDaysAgo }
    });
    console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    return result;
  }
}

module.exports = NotificationService;