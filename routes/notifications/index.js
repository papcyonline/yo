const { User, Notification } = require('../../models');
const { Expo } = require('expo-server-sdk');

// Initialize Expo SDK
const expo = new Expo();

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (page - 1) * limit;

    let query = { user_id: req.userId };
    if (unreadOnly === 'true') {
      query.is_read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      user_id: req.userId,
      is_read: false
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user_id: req.userId },
      { $set: { is_read: true, read_at: new Date() } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user_id: req.userId, is_read: false },
      { $set: { is_read: true, read_at: new Date() } }
    );

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read'
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await Notification.deleteOne({
      _id: notificationId,
      user_id: req.userId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Create notification (internal function)
const createNotification = async (userId, data) => {
  try {
    const notification = new Notification({
      user_id: userId,
      type: data.type || 'info',
      title: data.title,
      message: data.message,
      data: data.data || {},
      priority: data.priority || 'normal'
    });

    await notification.save();

    // Send push notification if user has expo token
    await sendPushNotification(userId, {
      title: data.title,
      body: data.message,
      data: data.data
    });

    return notification;

  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

// Send push notification
const sendPushNotification = async (userId, notification) => {
  try {
    const user = await User.findById(userId).select('expo_push_token push_notifications_enabled');
    
    if (!user || !user.expo_push_token || !user.push_notifications_enabled) {
      return;
    }

    // Check that the token is valid
    if (!Expo.isExpoPushToken(user.expo_push_token)) {
      console.error(`Invalid Expo push token: ${user.expo_push_token}`);
      return;
    }

    const message = {
      to: user.expo_push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {}
    };

    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log('Push notification sent:', receipts);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }

  } catch (error) {
    console.error('Send push notification error:', error);
  }
};

// Update push notification token
const updatePushToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || !Expo.isExpoPushToken(token)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid push token'
      });
    }

    await User.findByIdAndUpdate(req.userId, {
      $set: { expo_push_token: token }
    });

    res.json({
      success: true,
      message: 'Push token updated successfully'
    });

  } catch (error) {
    console.error('Update push token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update push token'
    });
  }
};

// Get notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('push_notifications_enabled email_notifications_enabled sms_notifications_enabled notification_preferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const preferences = {
      push_notifications: user.push_notifications_enabled || false,
      email_notifications: user.email_notifications_enabled || false,
      sms_notifications: user.sms_notifications_enabled || false,
      ...(user.notification_preferences || {})
    };

    res.json({
      success: true,
      data: { preferences }
    });

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences'
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const { push_notifications, email_notifications, sms_notifications, ...otherPreferences } = req.body;

    const updates = {};
    if (typeof push_notifications === 'boolean') {
      updates.push_notifications_enabled = push_notifications;
    }
    if (typeof email_notifications === 'boolean') {
      updates.email_notifications_enabled = email_notifications;
    }
    if (typeof sms_notifications === 'boolean') {
      updates.sms_notifications_enabled = sms_notifications;
    }
    if (Object.keys(otherPreferences).length > 0) {
      updates.notification_preferences = otherPreferences;
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, select: 'push_notifications_enabled email_notifications_enabled sms_notifications_enabled notification_preferences' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        preferences: {
          push_notifications: user.push_notifications_enabled,
          email_notifications: user.email_notifications_enabled,
          sms_notifications: user.sms_notifications_enabled,
          ...(user.notification_preferences || {})
        }
      }
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences'
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendPushNotification,
  updatePushToken,
  getNotificationPreferences,
  updateNotificationPreferences
};