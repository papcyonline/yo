const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
  blocker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blocked: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate', 'fake_profile', 'other'],
    default: 'other'
  },
  description: {
    type: String,
    maxlength: 500
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // For potential future unblocking
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
blockedUserSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
blockedUserSchema.index({ blocker: 1, createdAt: -1 });
blockedUserSchema.index({ blocked: 1, createdAt: -1 });

// Static methods
blockedUserSchema.statics.isBlocked = async function(blockerId, blockedId) {
  const block = await this.findOne({
    blocker: blockerId,
    blocked: blockedId,
    isActive: true
  });
  return !!block;
};

blockedUserSchema.statics.isBlockedEither = async function(userId1, userId2) {
  const block = await this.findOne({
    $or: [
      { blocker: userId1, blocked: userId2, isActive: true },
      { blocker: userId2, blocked: userId1, isActive: true }
    ]
  });
  return !!block;
};

blockedUserSchema.statics.getBlockedUsers = async function(userId) {
  return this.find({
    blocker: userId,
    isActive: true
  }).populate('blocked', 'first_name last_name profilePictureUrl');
};

blockedUserSchema.statics.blockUser = async function(blockerId, blockedId, reason = 'other', description = '') {
  // Check if already blocked
  const existing = await this.findOne({
    blocker: blockerId,
    blocked: blockedId
  });

  if (existing) {
    if (existing.isActive) {
      throw new Error('User is already blocked');
    } else {
      // Reactivate the block
      existing.isActive = true;
      existing.reason = reason;
      existing.description = description;
      return await existing.save();
    }
  }

  // Create new block
  return await this.create({
    blocker: blockerId,
    blocked: blockedId,
    reason,
    description
  });
};

blockedUserSchema.statics.unblockUser = async function(blockerId, blockedId) {
  const block = await this.findOne({
    blocker: blockerId,
    blocked: blockedId,
    isActive: true
  });

  if (!block) {
    throw new Error('User is not blocked');
  }

  block.isActive = false;
  return await block.save();
};

const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);

module.exports = BlockedUser;