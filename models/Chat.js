const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'voice', 'video', 'document', 'location'],
    default: 'text'
  },
  content: {
    text: String,
    mediaUrl: String,
    mediaFilename: String,
    mediaSize: Number,
    mediaType: String,
    thumbnailUrl: String,
    duration: Number, // for voice/video messages
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  status: {
    type: String,
    enum: ['sending', 'sent', 'delivered', 'read'],
    default: 'sending'
  },
  deliveredAt: Date,
  readAt: Date,
  editedAt: Date,
  isEdited: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }], // For "delete for me" vs "delete for everyone"
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const chatSchema = new mongoose.Schema({
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    leftAt: Date,
    isActive: {
      type: Boolean,
      default: true
    },
    lastSeenMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    lastSeenAt: Date,
    unreadCount: {
      type: Number,
      default: 0
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    mutedUntil: Date,
    customName: String, // Custom chat name for this user
    isPinned: {
      type: Boolean,
      default: false
    },
    pinnedAt: Date
  }],
  chatType: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  groupInfo: {
    name: String,
    description: String,
    avatar: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    settings: {
      allowMembersToAddOthers: {
        type: Boolean,
        default: false
      },
      allowMembersToEditGroupInfo: {
        type: Boolean,
        default: false
      },
      allowMembersToSendMessages: {
        type: Boolean,
        default: true
      }
    }
  },
  lastMessage: {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    text: String,
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    messageType: String,
    timestamp: Date
  },
  settings: {
    disappearingMessages: {
      enabled: {
        type: Boolean,
        default: false
      },
      duration: {
        type: Number,
        default: 604800000 // 7 days in milliseconds
      }
    },
    encryption: {
      enabled: {
        type: Boolean,
        default: true
      },
      keyRotationInterval: {
        type: Number,
        default: 2592000000 // 30 days
      }
    }
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date,
  archivedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ status: 1 });
messageSchema.index({ 'content.text': 'text' }); // For message search

chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ 'lastMessage.timestamp': -1 });
chatSchema.index({ updatedAt: -1 });

// Virtual for unread messages count
chatSchema.virtual('unreadMessagesCount').get(function() {
  return this.participants.reduce((sum, participant) => sum + participant.unreadCount, 0);
});

// Methods
chatSchema.methods.getParticipant = function(userId) {
  return this.participants.find(p => p.userId.toString() === userId.toString());
};

chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => 
    p.userId.toString() === userId.toString() && p.isActive
  );
};

chatSchema.methods.updateLastMessage = function(message) {
  this.lastMessage = {
    messageId: message._id,
    text: message.content.text || this.getMessagePreview(message),
    senderId: message.senderId,
    messageType: message.messageType,
    timestamp: message.createdAt
  };
  this.updatedAt = new Date();
};

chatSchema.methods.getMessagePreview = function(message) {
  switch(message.messageType) {
    case 'image': return '📸 Photo';
    case 'voice': return '🎤 Voice message';
    case 'video': return '🎥 Video';
    case 'document': return '📄 Document';
    case 'location': return '📍 Location';
    default: return message.content.text || 'Message';
  }
};

// Pre-save middleware
chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

messageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Message = mongoose.model('Message', messageSchema);
const Chat = mongoose.model('Chat', chatSchema);

module.exports = { Chat, Message };