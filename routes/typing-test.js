const { User } = require('../../models');
const { Chat, Message } = require('../../models/Chat');

// Get user's chat list
const getChats = async (req, res) => {
  try {
    // Find chats where user is a participant
    const chats = await Chat.find({
      'participants.userId': req.userId,
      'participants.isActive': true
    })
    .populate('participants.userId', 'first_name last_name profile_photo_url')
    .populate('lastMessage.senderId', 'first_name last_name')
    .sort({ 'lastMessage.timestamp': -1, updatedAt: -1 });

    // Format chat data
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => 
        p.userId._id.toString() !== req.userId.toString()
      );
      const currentParticipant = chat.participants.find(p => 
        p.userId._id.toString() === req.userId.toString()
      );

      return {
        id: chat._id,
        type: chat.chatType || 'direct',
        name: chat.groupInfo?.name,
        description: chat.groupInfo?.description,
        otherParticipant: otherParticipant ? {
          id: otherParticipant.userId._id,
          name: `${otherParticipant.userId.first_name} ${otherParticipant.userId.last_name}`,
          profilePhoto: otherParticipant.userId.profile_photo_url
        } : null,
        participants: chat.participants,
        lastMessage: chat.lastMessage || null,
        unreadCount: currentParticipant?.unreadCount || 0,
        isPinned: currentParticipant?.isPinned || false,
        isMuted: currentParticipant?.isMuted || false,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      };
    });

    res.json({
      success: true,
      data: { chats: formattedChats }
    });

  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chats'
    });
  }
};

// Create new chat
const createChat = async (req, res) => {
  try {
    const { participants, name, chatType = 'direct' } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Participants are required'
      });
    }

    // Add current user to participants if not already included
    const allParticipantIds = [...new Set([req.userId, ...participants])];

    // Create participant objects with proper structure
    const participantObjects = allParticipantIds.map(userId => ({
      userId,
      role: userId === req.userId ? 'admin' : 'member',
      isActive: true,
      unreadCount: 0
    }));

    // Create chat with proper schema
    const chatData = {
      chatType,
      participants: participantObjects
    };

    // Add group info if it's a group chat
    if (chatType === 'group') {
      chatData.groupInfo = {
        name: name || `Group ${Date.now()}`,
        createdBy: req.userId,
        admins: [req.userId]
      };
    }

    const chat = new Chat(chatData);
    await chat.save();

    // Populate participants for response
    await chat.populate('participants.userId', 'first_name last_name profile_photo_url');

    res.json({
      success: true,
      message: 'Chat created successfully',
      data: { chat }
    });

  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chat'
    });
  }
};

// Get messages for a specific chat
const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': req.userId,
      'participants.isActive': true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    // Get messages
    const messages = await Message.find({ 
      chatId,
      isDeleted: false,
      $or: [
        { deletedFor: { $nin: [req.userId] } },
        { deletedFor: { $exists: false } }
      ]
    })
      .populate('senderId', 'first_name last_name profile_photo_url')
      .populate('replyTo', 'content senderId messageType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({ 
      chatId,
      isDeleted: false 
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to show oldest first
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        }
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Check if user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': req.userId,
      'participants.isActive': true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    // Create message
    const message = new Message({
      chatId,
      senderId: req.userId,
      messageType,
      content: messageType === 'text' ? { text: content.trim() } : content,
      status: 'sent'
    });

    await message.save();

    // Update chat's last message
    chat.updateLastMessage(message);
    
    // Update unread counts for other participants
    chat.participants.forEach(participant => {
      if (participant.userId.toString() !== req.userId.toString() && participant.isActive) {
        participant.unreadCount += 1;
      }
    });
    
    await chat.save();

    // Populate sender for response
    await message.populate('senderId', 'first_name last_name profile_photo_url');

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: { message }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Get chat details
const getChatDetails = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': req.userId,
      'participants.isActive': true
    }).populate('participants.userId', 'first_name last_name profile_photo_url');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    res.json({
      success: true,
      data: { chat }
    });

  } catch (error) {
    console.error('Get chat details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat details'
    });
  }
};

// Leave chat
const leaveChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);

    if (!chat || !chat.isParticipant(req.userId)) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found or access denied'
      });
    }

    // Mark participant as inactive instead of removing
    const participant = chat.getParticipant(req.userId);
    if (participant) {
      participant.isActive = false;
      participant.leftAt = new Date();
      await chat.save();
    }

    res.json({
      success: true,
      message: 'Successfully left chat'
    });

  } catch (error) {
    console.error('Leave chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave chat'
    });
  }
};

module.exports = {
  getChats,
  createChat,
  getMessages,
  sendMessage,
  getChatDetails,
  leaveChat
};