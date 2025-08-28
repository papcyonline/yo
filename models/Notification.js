const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'new_match', 
      'high_match',  // For matches above 65%
      'new_message', 
      'new_chat',
      'community_match',
      'friend_request',
      'friend_accepted',
      'profile_update', 
      'system_message', 
      'welcome', 
      'questionnaire_complete'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  action_url: {
    type: String,
    maxlength: 200
  },
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for efficient queries
notificationSchema.index({ user_id: 1, read: 1, created_at: -1 });
notificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Static method to create match notification
notificationSchema.statics.createMatchNotification = async function(userId, matchData) {
  const notification = new this({
    user_id: userId,
    type: 'new_match',
    title: `New ${matchData.type} match found!`,
    message: `You matched with ${matchData.name} (${matchData.score} points) - ${matchData.reason}`,
    data: {
      match_id: matchData.userId,
      match_name: matchData.name,
      match_type: matchData.type,
      match_score: matchData.score,
      match_reason: matchData.reason
    },
    priority: matchData.type === 'family' ? 'high' : 'normal',
    action_url: '/matches'
  });
  
  return await notification.save();
};

// Static method to create system notification
notificationSchema.statics.createSystemNotification = async function(userId, title, message, data = {}) {
  const notification = new this({
    user_id: userId,
    type: 'system_message',
    title,
    message,
    data,
    priority: 'normal'
  });
  
  return await notification.save();
};

// Static method for high-confidence match notification (65%+)
notificationSchema.statics.createHighMatchNotification = async function(userId, matchData) {
  const relationshipText = matchData.predictedRelationship || matchData.type;
  const notification = new this({
    user_id: userId,
    type: 'high_match',
    title: `🎯 High-confidence ${relationshipText} match!`,
    message: `${matchData.name} is a ${Math.round(matchData.score * 100)}% match! ${matchData.reason || 'Strong connection detected.'}`,
    data: {
      match_id: matchData.userId,
      match_name: matchData.name,
      match_type: matchData.type,
      match_score: matchData.score,
      match_reason: matchData.reason,
      predicted_relationship: matchData.predictedRelationship
    },
    priority: 'high',
    action_url: '/matches'
  });
  
  return await notification.save();
};

// Static method for new chat message notification
notificationSchema.statics.createMessageNotification = async function(userId, messageData) {
  const notification = new this({
    user_id: userId,
    type: 'new_message',
    title: `💬 New message from ${messageData.senderName}`,
    message: messageData.preview || 'You have a new message',
    data: {
      chat_id: messageData.chatId,
      sender_id: messageData.senderId,
      sender_name: messageData.senderName,
      message_preview: messageData.preview
    },
    priority: 'normal',
    action_url: `/chats/${messageData.chatId}`
  });
  
  return await notification.save();
};

// Static method for new chat notification
notificationSchema.statics.createNewChatNotification = async function(userId, chatData) {
  const notification = new this({
    user_id: userId,
    type: 'new_chat',
    title: `💬 ${chatData.initiatorName} started a chat with you`,
    message: `Start chatting with ${chatData.initiatorName}`,
    data: {
      chat_id: chatData.chatId,
      initiator_id: chatData.initiatorId,
      initiator_name: chatData.initiatorName
    },
    priority: 'normal',
    action_url: `/chats/${chatData.chatId}`
  });
  
  return await notification.save();
};

// Static method for community match notification
notificationSchema.statics.createCommunityMatchNotification = async function(userId, communityData) {
  const notification = new this({
    user_id: userId,
    type: 'community_match',
    title: `🌍 New community match: ${communityData.name}`,
    message: `You've been matched with "${communityData.name}" community based on your interests`,
    data: {
      community_id: communityData.id,
      community_name: communityData.name,
      match_reason: communityData.reason
    },
    priority: 'normal',
    action_url: `/communities/${communityData.id}`
  });
  
  return await notification.save();
};

// Static method for friend request notification
notificationSchema.statics.createFriendRequestNotification = async function(userId, requestData) {
  const notification = new this({
    user_id: userId,
    type: 'friend_request',
    title: `👋 ${requestData.requesterName} sent you a friend request`,
    message: requestData.message || `${requestData.requesterName} wants to connect with you`,
    data: {
      request_id: requestData.requestId,
      requester_id: requestData.requesterId,
      requester_name: requestData.requesterName
    },
    priority: 'normal',
    action_url: '/friend-requests'
  });
  
  return await notification.save();
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    user_id: userId,
    read: false,
    expires_at: { $gt: new Date() }
  });
};

module.exports = mongoose.model('Notification', notificationSchema);