const { supabase } = require('../config/database');

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, unread_only = false } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('notifications')
      .select(`
        id, notification_type, title, message, data, is_read, 
        priority, action_url, read_at, created_at
      `)
      .eq('user_id', req.userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by type if specified
    if (type && ['match', 'message', 'system', 'welcome', 'achievement', 'reminder'].includes(type)) {
      query = query.eq('notification_type', type);
    }

    // Filter by unread only if specified
    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Get unread count
    const { count: unreadCount, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('is_read', false)
      .eq('is_deleted', false);

    if (countError) throw countError;

    // Get total count for pagination
    const { count: totalCount, error: totalError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.userId)
      .eq('is_deleted', false);

    if (totalError) throw totalError;

    res.json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
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

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification }
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .eq('is_read', false)
      .eq('is_deleted', false)
      .select();

    if (error) throw error;

    res.json({
      success: true,
      message: `Marked ${notifications.length} notifications as read`,
      data: { updated_count: notifications.length }
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
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

    const { data: notification, error } = await supabase
      .from('notifications')
      .update({
        is_deleted: true
      })
      .eq('id', notificationId)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Notification deleted successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification'
    });
  }
};

// Get system messages for all users
const getSystemMessages = async (req, res) => {
  try {
    const { data: messages, error } = await supabase
      .from('system_messages')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', new Date().toISOString())
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: { messages }
    });

  } catch (error) {
    console.error('Get system messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system messages'
    });
  }
};

// Create notification (internal use)
const createNotification = async (userId, type, title, message, data = {}, priority = 'normal') => {
  try {
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        notification_type: type,
        title,
        message,
        data,
        priority
      })
      .select()
      .single();

    if (error) throw error;

    return { success: true, notification };
  } catch (error) {
    console.error('Create notification error:', error);
    return { success: false, error: error.message };
  }
};

// Create match notification
const createMatchNotification = async (req, res) => {
  try {
    const { user_id, match_type, matched_user_name, match_score } = req.body;

    const title = `New ${match_type} match found!`;
    const message = `You have a ${Math.round(match_score)}% match with ${matched_user_name}. Check it out!`;
    
    const result = await createNotification(
      user_id,
      'match',
      title,
      message,
      { match_type, matched_user_name, match_score },
      'high'
    );

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create match notification'
      });
    }

    res.json({
      success: true,
      message: 'Match notification created',
      data: { notification: result.notification }
    });

  } catch (error) {
    console.error('Create match notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create match notification'
    });
  }
};

// Create welcome notification for new users
const createWelcomeNotification = async (userId) => {
  const title = 'Yo! Welcome to the family! 👋';
  const message = 'Welcome to Yo! Complete your profile to start discovering amazing family connections and building meaningful relationships.';
  
  return await createNotification(
    userId,
    'welcome',
    title,
    message,
    { action: 'complete_profile' },
    'high'
  );
};

// Create achievement notification
const createAchievementNotification = async (userId, achievement, points) => {
  const title = `Achievement unlocked! 🎉`;
  const message = `You earned ${points} points for: ${achievement}`;
  
  return await createNotification(
    userId,
    'achievement',
    title,
    message,
    { achievement, points },
    'normal'
  );
};

// Get notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('notification_preferences')
      .eq('id', req.userId)
      .single();

    if (error) throw error;

    const defaultPreferences = {
      matches: true,
      messages: true,
      system: true,
      email: true,
      push: true
    };

    res.json({
      success: true,
      data: { 
        preferences: user.notification_preferences || defaultPreferences 
      }
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
    const { preferences } = req.body;

    // Validate preferences
    const validKeys = ['matches', 'messages', 'system', 'email', 'push'];
    const validPreferences = {};
    
    validKeys.forEach(key => {
      if (typeof preferences[key] === 'boolean') {
        validPreferences[key] = preferences[key];
      }
    });

    const { data: user, error } = await supabase
      .from('users')
      .update({
        notification_preferences: validPreferences
      })
      .eq('id', req.userId)
      .select('notification_preferences')
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: { preferences: user.notification_preferences }
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
  getSystemMessages,
  createNotification,
  createMatchNotification,
  createWelcomeNotification,
  createAchievementNotification,
  getNotificationPreferences,
  updateNotificationPreferences
};