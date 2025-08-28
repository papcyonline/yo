const { Chat, Message } = require('../models/Chat');
const { User } = require('../models');
const mongoose = require('mongoose');
const { contentModerationService } = require('./contentModerationService');

class ChatService {
  constructor(io) {
    this.io = io;
    this.activeUsers = new Map(); // userId -> socketId
    this.typingUsers = new Map(); // chatId -> Set of userIds
    this.recordingUsers = new Map(); // chatId -> Set of userIds
  }

  // User connection management
  handleUserConnection(socket, userId) {
    this.activeUsers.set(userId, socket.id);
    console.log(`🟢 User ${userId} connected with socket ${socket.id}`);
    
    // Join user to their chat rooms
    this.joinUserChats(socket, userId);
    
    // Emit online status to other users
    this.broadcastUserStatus(userId, 'online');
  }

  handleUserDisconnection(socket, userId) {
    this.activeUsers.delete(userId);
    console.log(`🔴 User ${userId} disconnected`);
    
    // Clear typing indicators for this user
    this.clearUserTyping(userId);
    
    // Clear recording indicators for this user
    this.clearUserRecording(userId);
    
    // Emit offline status to other users
    this.broadcastUserStatus(userId, 'offline');
  }

  async joinUserChats(socket, userId) {
    try {
      const chats = await Chat.find({
        'participants.userId': userId,
        'participants.isActive': true
      }).select('_id');
      
      chats.forEach(chat => {
        socket.join(`chat_${chat._id}`);
      });
      
      console.log(`📱 User ${userId} joined ${chats.length} chat rooms`);
    } catch (error) {
      console.error('Error joining user chats:', error);
    }
  }

  // Create or get existing chat
  async createOrGetChat(user1Id, user2Id) {
    try {
      // Check if direct chat already exists
      let chat = await Chat.findOne({
        chatType: 'direct',
        'participants.userId': { $all: [user1Id, user2Id] },
        'participants.isActive': true
      }).populate('participants.userId', 'first_name last_name email');

      if (chat) {
        return chat;
      }

      // Get user details
      const [user1, user2] = await Promise.all([
        User.findById(user1Id).select('first_name last_name email'),
        User.findById(user2Id).select('first_name last_name email')
      ]);

      if (!user1 || !user2) {
        throw new Error('One or both users not found');
      }

      // Create new chat
      chat = new Chat({
        chatType: 'direct',
        participants: [
          {
            userId: user1Id,
            role: 'member',
            isActive: true,
            unreadCount: 0
          },
          {
            userId: user2Id,
            role: 'member',
            isActive: true,
            unreadCount: 0
          }
        ]
      });

      await chat.save();
      await chat.populate('participants.userId', 'first_name last_name email');

      console.log(`✅ Created new chat: ${chat._id}`);
      return chat;
    } catch (error) {
      console.error('Error creating/getting chat:', error);
      throw error;
    }
  }

  // Send message with full WhatsApp-like features
  async sendMessage(chatId, senderId, messageData) {
    try {
      // Get chat and verify sender is participant
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(senderId)) {
        throw new Error('Chat not found or user not authorized');
      }

      // Content moderation for text messages
      let moderatedContent = messageData.content;
      let messageBlocked = false;

      if (messageData.messageType === 'text' && messageData.content) {
        console.log(`🔍 Moderating message from user ${senderId}...`);
        
        const moderationResult = await contentModerationService.processMessage({
          content: messageData.content
        }, senderId);

        if (!moderationResult.allowed) {
          console.log(`🚫 Message blocked: ${moderationResult.reason}`);
          
          // Emit blocking notification to sender
          const senderSocketId = this.activeUsers.get(senderId.toString());
          if (senderSocketId) {
            this.io.to(senderSocketId).emit('message_blocked', {
              chatId,
              reason: moderationResult.reason,
              analysis: moderationResult.analysis,
              timestamp: new Date()
            });
          }

          throw new Error(moderationResult.reason || 'Message blocked due to policy violations');
        }

        // Use cleaned content if available
        if (moderationResult.cleanedContent !== messageData.content) {
          moderatedContent = moderationResult.cleanedContent;
          console.log(`🧼 Content filtered for profanity`);
        }
      }

      // Create message
      const message = new Message({
        chatId,
        senderId,
        messageType: messageData.messageType || 'text',
        content: moderatedContent,
        status: 'sent',
        replyTo: messageData.replyTo
      });

      await message.save();

      // Update chat's last message
      chat.updateLastMessage(message);
      
      // Update unread counts for other participants
      chat.participants.forEach(participant => {
        if (participant.userId.toString() !== senderId.toString() && participant.isActive) {
          participant.unreadCount += 1;
        }
      });

      await chat.save();

      // Populate message with sender info
      await message.populate('senderId', 'first_name last_name email');

      // Emit message to chat participants
      this.io.to(`chat_${chatId}`).emit('new_message', {
        message: this.formatMessage(message),
        chat: {
          _id: chat._id,
          lastMessage: chat.lastMessage,
          updatedAt: chat.updatedAt
        }
      });

      // Emit unread count update to all participants
      chat.participants.forEach(participant => {
        if (participant.isActive) {
          this.io.to(`user_${participant.userId}`).emit('unread_count_update', {
            chatId: chat._id,
            unreadCount: participant.unreadCount,
            totalUnreadCount: participant.userId.toString() !== senderId.toString() ? participant.unreadCount : 0
          });
        }
      });

      console.log(`📨 Message sent: ${message._id} in chat ${chatId} by ${senderId}`);

      // Update delivery status for online users
      this.updateMessageDeliveryStatus(message, chat);

      console.log(`📤 Message sent in chat ${chatId} by user ${senderId}`);
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Update message delivery status
  async updateMessageDeliveryStatus(message, chat) {
    try {
      const onlineParticipants = chat.participants.filter(p => 
        p.userId.toString() !== message.senderId.toString() && 
        p.isActive &&
        this.activeUsers.has(p.userId.toString())
      );

      if (onlineParticipants.length > 0) {
        // Mark as delivered for online users
        await Message.findByIdAndUpdate(message._id, {
          status: 'delivered',
          deliveredAt: new Date()
        });

        // Emit delivery confirmation to sender
        const senderSocketId = this.activeUsers.get(message.senderId.toString());
        if (senderSocketId) {
          this.io.to(senderSocketId).emit('message_delivered', {
            messageId: message._id,
            chatId: message.chatId,
            deliveredAt: new Date()
          });
        }

        console.log(`✅ Message ${message._id} marked as delivered`);
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
    }
  }

  // Mark messages as read
  async markMessagesAsRead(chatId, userId, messageIds = []) {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(userId)) {
        throw new Error('Chat not found or user not authorized');
      }

      // Update message read status
      const query = messageIds.length > 0 
        ? { _id: { $in: messageIds }, chatId, senderId: { $ne: userId } }
        : { chatId, senderId: { $ne: userId }, status: { $in: ['sent', 'delivered'] } };

      await Message.updateMany(query, {
        status: 'read',
        readAt: new Date()
      });

      // Update user's unread count and last seen
      const participant = chat.getParticipant(userId);
      if (participant) {
        participant.unreadCount = 0;
        participant.lastSeenAt = new Date();
        
        // Set last seen message
        if (messageIds.length > 0) {
          participant.lastSeenMessageId = messageIds[messageIds.length - 1];
        } else {
          const lastMessage = await Message.findOne({ chatId }).sort({ createdAt: -1 });
          if (lastMessage) {
            participant.lastSeenMessageId = lastMessage._id;
          }
        }
      }

      await chat.save();

      // Get affected messages for read receipt
      const affectedMessages = await Message.find({
        _id: { $in: messageIds.length > 0 ? messageIds : [] },
        chatId,
        senderId: { $ne: userId }
      }).select('_id senderId');

      // Send read receipts to message senders
      affectedMessages.forEach(msg => {
        const senderSocketId = this.activeUsers.get(msg.senderId.toString());
        if (senderSocketId) {
          this.io.to(senderSocketId).emit('message_read', {
            messageId: msg._id,
            chatId,
            readBy: userId,
            readAt: new Date()
          });
        }
      });

      // Emit updated chat info to all participants
      this.io.to(`chat_${chatId}`).emit('chat_updated', {
        chatId,
        updatedAt: new Date(),
        unreadCounts: chat.participants.map(p => ({
          userId: p.userId,
          unreadCount: p.unreadCount
        }))
      });

      console.log(`👀 Messages marked as read in chat ${chatId} by user ${userId}`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Get chat messages with pagination
  async getChatMessages(chatId, userId, page = 1, limit = 50) {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat || !chat.isParticipant(userId)) {
        throw new Error('Chat not found or user not authorized');
      }

      const skip = (page - 1) * limit;

      const messages = await Message.find({
        chatId,
        isDeleted: false,
        $or: [
          { deletedFor: { $nin: [userId] } },
          { deletedFor: { $exists: false } }
        ]
      })
        .populate('senderId', 'first_name last_name email profile_photo_url')
        .populate('replyTo', 'content senderId messageType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      return {
        messages: messages.reverse().map(msg => this.formatMessage(msg)),
        hasMore: messages.length === limit,
        page,
        totalMessages: await Message.countDocuments({ chatId, isDeleted: false })
      };
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  // Get user's chats
  async getUserChats(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const chats = await Chat.find({
        'participants.userId': userId,
        'participants.isActive': true
      })
        .populate('participants.userId', 'first_name last_name email')
        .populate('lastMessage.senderId', 'first_name last_name')
        .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit);

      const formattedChats = chats.map(chat => this.formatChat(chat, userId));

      return {
        chats: formattedChats,
        hasMore: chats.length === limit,
        page
      };
    } catch (error) {
      console.error('Error getting user chats:', error);
      throw error;
    }
  }

  // Typing indicators
  handleTyping(chatId, userId, isTyping) {
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }

    const typingSet = this.typingUsers.get(chatId);

    if (isTyping) {
      typingSet.add(userId);
    } else {
      typingSet.delete(userId);
    }

    // Broadcast typing status to other participants
    this.io.to(`chat_${chatId}`).emit('typing_update', {
      chatId,
      typingUsers: Array.from(typingSet).filter(id => id !== userId)
    });

    // Auto-clear typing after 3 seconds
    if (isTyping) {
      setTimeout(() => {
        const currentSet = this.typingUsers.get(chatId);
        if (currentSet) {
          currentSet.delete(userId);
          this.io.to(`chat_${chatId}`).emit('typing_update', {
            chatId,
            typingUsers: Array.from(currentSet).filter(id => id !== userId)
          });
        }
      }, 3000);
    }
  }

  clearUserTyping(userId) {
    this.typingUsers.forEach((typingSet, chatId) => {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        this.io.to(`chat_${chatId}`).emit('typing_update', {
          chatId,
          typingUsers: Array.from(typingSet).filter(id => id !== userId)
        });
      }
    });
  }

  // Recording indicators
  handleRecording(chatId, userId, isRecording) {
    if (!this.recordingUsers.has(chatId)) {
      this.recordingUsers.set(chatId, new Set());
    }

    const recordingSet = this.recordingUsers.get(chatId);

    if (isRecording) {
      recordingSet.add(userId);
    } else {
      recordingSet.delete(userId);
    }

    // Broadcast recording status to other participants
    this.io.to(`chat_${chatId}`).emit('recording_update', {
      chatId,
      recordingUsers: Array.from(recordingSet),
      isRecording: recordingSet.size > 0
    });
  }

  clearUserRecording(userId) {
    this.recordingUsers.forEach((recordingSet, chatId) => {
      if (recordingSet.has(userId)) {
        recordingSet.delete(userId);
        this.io.to(`chat_${chatId}`).emit('recording_update', {
          chatId,
          recordingUsers: Array.from(recordingSet).filter(id => id !== userId)
        });
      }
    });
  }

  // Broadcast user online/offline status
  async broadcastUserStatus(userId, status) {
    try {
      // Update user status in database
      await User.findByIdAndUpdate(userId, {
        status: status,
        is_online: status !== 'offline',
        last_seen: status === 'offline' ? new Date() : undefined
      });

      const userChats = await Chat.find({
        'participants.userId': userId,
        'participants.isActive': true
      }).select('_id');

      userChats.forEach(chat => {
        this.io.to(`chat_${chat._id}`).emit('user_status_update', {
          userId,
          status,
          lastSeen: status === 'offline' ? new Date() : null
        });
      });
    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }

  // Format message for frontend
  formatMessage(message) {
    // Ensure image URLs are properly formatted for display
    const formattedContent = { ...message.content };
    
    // If it's an image/video message, ensure the URL is accessible
    if (message.messageType === 'image' || message.messageType === 'video') {
      // If mediaUrl exists and is a Cloudinary URL, it should work directly
      if (formattedContent.mediaUrl) {
        // Ensure it's a full URL (Cloudinary URLs are already full URLs)
        if (!formattedContent.mediaUrl.startsWith('http')) {
          // If it's a local path, convert to full URL (fallback for old messages)
          formattedContent.mediaUrl = `${process.env.BASE_URL || 'http://localhost:9000'}${formattedContent.mediaUrl}`;
        }
        console.log(`🖼️ Image/Video URL: ${formattedContent.mediaUrl}`);
      }
    }
    
    return {
      _id: message._id,
      chatId: message.chatId,
      senderId: message.senderId._id || message.senderId,
      senderName: message.senderId.first_name && message.senderId.last_name 
        ? `${message.senderId.first_name} ${message.senderId.last_name}`
        : 'Unknown User',
      messageType: message.messageType,
      content: formattedContent,
      status: message.status,
      deliveredAt: message.deliveredAt,
      readAt: message.readAt,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      replyTo: message.replyTo,
      reactions: message.reactions,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }

  // Format chat for frontend
  formatChat(chat, currentUserId) {
    const otherParticipant = chat.participants.find(p => 
      p.userId._id.toString() !== currentUserId.toString()
    );

    const currentParticipant = chat.participants.find(p => 
      p.userId._id.toString() === currentUserId.toString()
    );

    return {
      _id: chat._id,
      chatType: chat.chatType,
      otherParticipant: otherParticipant ? {
        _id: otherParticipant.userId._id,
        name: `${otherParticipant.userId.first_name} ${otherParticipant.userId.last_name}`,
        email: otherParticipant.userId.email,
        isOnline: this.activeUsers.has(otherParticipant.userId._id.toString())
      } : null,
      lastMessage: chat.lastMessage,
      unreadCount: currentParticipant?.unreadCount || 0,
      isPinned: currentParticipant?.isPinned || false,
      isMuted: currentParticipant?.isMuted || false,
      lastSeenAt: currentParticipant?.lastSeenAt,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    };
  }

  // ==================== WEBRTC CALL SIGNALING ====================
  
  /**
   * Handle call initiation
   */
  async handleCallOffer(socket, data) {
    try {
      const { callId, targetUserId, offer, callType = 'voice' } = data;
      const callerId = socket.userId;

      console.log('📞 Call offer received:', { callId, callerId, targetUserId, callType });

      // Get target user's socket
      const targetSocketId = this.activeUsers.get(targetUserId);
      
      if (!targetSocketId) {
        console.log('❌ Target user offline:', targetUserId);
        socket.emit('call_failed', { 
          callId, 
          reason: 'user_offline',
          message: 'User is not online'
        });
        return;
      }

      // Import Call model
      const Call = require('../models/Call');
      
      // Find the call record
      const call = await Call.findOne({ callId });
      if (!call) {
        socket.emit('call_failed', { 
          callId, 
          reason: 'call_not_found',
          message: 'Call record not found'
        });
        return;
      }

      // Store the offer
      await call.setOffer(offer);
      await call.updateStatus('ringing');

      // Get caller info from user model
      const User = require('../models/User');
      const callerInfo = await User.findById(callerId).select('name profileImage');
      
      // Emit to target user
      this.io.to(targetSocketId).emit('incoming_call', {
        callId,
        callType,
        offer,
        caller: {
          id: callerId,
          name: callerInfo?.name || socket.userName || 'Unknown',
          profileImage: callerInfo?.profileImage
        },
        timestamp: new Date()
      });

      console.log('✅ Call offer sent to target user');

    } catch (error) {
      console.error('❌ Error handling call offer:', error);
      socket.emit('call_failed', { 
        callId: data.callId, 
        reason: 'server_error',
        message: 'Failed to process call offer'
      });
    }
  }

  /**
   * Handle call answer
   */
  async handleCallAnswer(socket, data) {
    try {
      const { callId, answer } = data;
      const answeredBy = socket.userId;

      console.log('📞 Call answer received:', { callId, answeredBy });

      // Import Call model
      const Call = require('../models/Call');
      
      // Find the call record
      const call = await Call.findOne({ callId });
      if (!call) {
        socket.emit('call_failed', { 
          callId, 
          reason: 'call_not_found',
          message: 'Call record not found'
        });
        return;
      }

      // Store the answer
      await call.setAnswer(answer);
      await call.updateStatus('active');

      // Get caller's socket
      const callerSocketId = this.activeUsers.get(call.initiator.toString());
      
      if (callerSocketId) {
        // Emit answer to caller
        this.io.to(callerSocketId).emit('call_answered', {
          callId,
          answer,
          answeredBy,
          timestamp: new Date()
        });
      }

      console.log('✅ Call answer sent to caller');

    } catch (error) {
      console.error('❌ Error handling call answer:', error);
      socket.emit('call_failed', { 
        callId: data.callId, 
        reason: 'server_error',
        message: 'Failed to process call answer'
      });
    }
  }

  /**
   * Handle ICE candidates
   */
  async handleIceCandidate(socket, data) {
    try {
      const { callId, candidate } = data;
      const senderId = socket.userId;

      console.log('🧊 ICE candidate received:', { callId, senderId });

      // Import Call model
      const Call = require('../models/Call');
      
      // Find the call record and add ICE candidate
      const call = await Call.findOne({ callId });
      if (call) {
        await call.addIceCandidate(candidate);
        
        // Get the other participant (not the sender)
        const targetUserId = call.callerId === senderId ? call.calleeId : call.callerId;
        const targetSocketId = this.activeUsers.get(targetUserId);
        
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('ice_candidate', {
            callId,
            candidate,
            senderId,
            timestamp: new Date()
          });
        }
      }

    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  }

  /**
   * Handle call end
   */
  async handleCallEnd(socket, data) {
    try {
      const { callId, reason = 'ended' } = data;
      const endedBy = socket.userId;

      console.log('📞 Call end received:', { callId, endedBy, reason });

      // Import Call model
      const Call = require('../models/Call');
      
      // Find and update call record
      const call = await Call.findOne({ callId });
      if (!call) {
        return;
      }

      await call.updateStatus('ended', { endReason: reason });

      // Notify both participants
      const participants = [call.initiator.toString(), call.recipient.toString()];
      
      participants.forEach(participantId => {
        if (participantId !== endedBy) {
          const socketId = this.activeUsers.get(participantId);
          if (socketId) {
            this.io.to(socketId).emit('call_ended', {
              callId,
              endedBy,
              reason,
              duration: call.duration,
              timestamp: new Date()
            });
          }
        }
      });

      console.log('✅ Call ended successfully');

    } catch (error) {
      console.error('❌ Error handling call end:', error);
    }
  }

  /**
   * Handle call decline
   */
  async handleCallDecline(socket, data) {
    try {
      const { callId, reason = 'declined' } = data;
      const declinedBy = socket.userId;

      console.log('📞 Call decline received:', { callId, declinedBy, reason });

      // Import Call model
      const Call = require('../models/Call');
      
      // Find and update call record
      const call = await Call.findOne({ callId });
      if (!call) {
        return;
      }

      await call.updateStatus('declined', { endReason: reason });

      // Notify caller
      const callerSocketId = this.activeUsers.get(call.initiator.toString());
      if (callerSocketId) {
        this.io.to(callerSocketId).emit('call_declined', {
          callId,
          declinedBy,
          reason,
          timestamp: new Date()
        });
      }

      console.log('✅ Call declined successfully');

    } catch (error) {
      console.error('❌ Error handling call decline:', error);
    }
  }

  /**
   * Handle missed call (timeout)
   */
  async handleCallMissed(callId) {
    try {
      console.log('📞 Call missed (timeout):', callId);

      // Import Call model
      const Call = require('../models/Call');
      
      // Find and update call record
      const call = await Call.findOne({ callId });
      if (!call) {
        return;
      }

      await call.updateStatus('missed', { endReason: 'timeout' });

      // Notify caller
      const callerSocketId = this.activeUsers.get(call.initiator.toString());
      if (callerSocketId) {
        this.io.to(callerSocketId).emit('call_missed', {
          callId,
          reason: 'timeout',
          timestamp: new Date()
        });
      }

      console.log('✅ Call marked as missed');

    } catch (error) {
      console.error('❌ Error handling missed call:', error);
    }
  }

  /**
   * Setup WebRTC call event handlers for a socket
   */
  setupCallHandlers(socket) {
    // Call signaling events
    socket.on('call_offer', (data) => this.handleCallOffer(socket, data));
    socket.on('call_answer', (data) => this.handleCallAnswer(socket, data));
    socket.on('ice_candidate', (data) => this.handleIceCandidate(socket, data));
    socket.on('call_end', (data) => this.handleCallEnd(socket, data));
    socket.on('call_decline', (data) => this.handleCallDecline(socket, data));

    console.log('📞 Call handlers setup for socket:', socket.id);
  }

  /**
   * Check if user is available for calls
   */
  async isUserAvailableForCall(userId) {
    try {
      // Check if user is online
      if (!this.activeUsers.has(userId)) {
        return { available: false, reason: 'offline' };
      }

      // Check if user has active call
      const Call = require('../models/Call');
      const activeCall = await Call.findActiveCall(userId);
      
      if (activeCall) {
        return { available: false, reason: 'busy' };
      }

      return { available: true };
    } catch (error) {
      console.error('❌ Error checking user availability:', error);
      return { available: false, reason: 'error' };
    }
  }
}

module.exports = ChatService;