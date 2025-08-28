const mongoose = require('mongoose');

const callSchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    unique: true,
    default: () => `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    required: true,
    default: 'voice'
  },
  status: {
    type: String,
    enum: ['initiating', 'ringing', 'connecting', 'active', 'ended', 'missed', 'declined', 'failed'],
    required: true,
    default: 'initiating'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  answeredAt: {
    type: Date
  },
  endedAt: {
    type: Date
  },
  duration: {
    type: Number, // Duration in seconds
    default: 0
  },
  endReason: {
    type: String,
    enum: ['completed', 'declined', 'missed', 'network_error', 'user_busy', 'timeout'],
    default: 'completed'
  },
  quality: {
    connectionType: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    latency: Number, // in ms
    packetLoss: Number, // percentage
    jitter: Number // in ms
  },
  webrtcData: {
    offer: mongoose.Schema.Types.Mixed,
    answer: mongoose.Schema.Types.Mixed,
    iceCandidates: [mongoose.Schema.Types.Mixed]
  },
  metadata: {
    userAgent: String,
    platform: String,
    network: String,
    deviceType: String
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
callSchema.index({ initiator: 1, createdAt: -1 });
callSchema.index({ recipient: 1, createdAt: -1 });
callSchema.index({ chatId: 1, createdAt: -1 });
callSchema.index({ status: 1, createdAt: -1 });
// callId already has unique: true which creates an index

// Virtual for call duration calculation
callSchema.virtual('calculatedDuration').get(function() {
  if (this.answeredAt && this.endedAt) {
    return Math.round((this.endedAt - this.answeredAt) / 1000);
  }
  return 0;
});

// Pre-save middleware to calculate duration
callSchema.pre('save', function(next) {
  if (this.answeredAt && this.endedAt && !this.duration) {
    this.duration = Math.round((this.endedAt - this.answeredAt) / 1000);
  }
  next();
});

// Static methods
callSchema.statics.findActiveCall = function(userId) {
  return this.findOne({
    $or: [
      { initiator: userId },
      { recipient: userId }
    ],
    status: { $in: ['initiating', 'ringing', 'connecting', 'active'] }
  });
};

callSchema.statics.getCallHistory = function(userId, limit = 50, offset = 0) {
  return this.find({
    $or: [
      { initiator: userId },
      { recipient: userId }
    ],
    status: { $in: ['ended', 'missed', 'declined'] }
  })
  .populate('initiator', 'first_name last_name profile_photo_url')
  .populate('recipient', 'first_name last_name profile_photo_url')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset);
};

callSchema.statics.getMissedCalls = function(userId) {
  return this.find({
    recipient: userId,
    status: 'missed'
  })
  .populate('initiator', 'first_name last_name profile_photo_url')
  .sort({ createdAt: -1 });
};

// Instance methods
callSchema.methods.updateStatus = function(status, additionalData = {}) {
  this.status = status;
  
  switch(status) {
    case 'ringing':
      // Call is ringing on recipient's device
      break;
    case 'active':
      this.answeredAt = new Date();
      break;
    case 'ended':
    case 'declined':
    case 'missed':
    case 'failed':
      this.endedAt = new Date();
      if (this.answeredAt) {
        this.duration = Math.round((this.endedAt - this.answeredAt) / 1000);
      }
      break;
  }
  
  Object.assign(this, additionalData);
  return this.save();
};

callSchema.methods.addIceCandidate = function(candidate) {
  if (!this.webrtcData) {
    this.webrtcData = { iceCandidates: [] };
  }
  if (!this.webrtcData.iceCandidates) {
    this.webrtcData.iceCandidates = [];
  }
  this.webrtcData.iceCandidates.push(candidate);
  return this.save();
};

callSchema.methods.setOffer = function(offer) {
  if (!this.webrtcData) {
    this.webrtcData = {};
  }
  this.webrtcData.offer = offer;
  return this.save();
};

callSchema.methods.setAnswer = function(answer) {
  if (!this.webrtcData) {
    this.webrtcData = {};
  }
  this.webrtcData.answer = answer;
  return this.save();
};

const Call = mongoose.model('Call', callSchema);

module.exports = Call;