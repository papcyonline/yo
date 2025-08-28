const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipient_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
    index: true
  },
  message: {
    type: String,
    maxlength: 500
  },
  match_context: {
    match_type: {
      type: String,
      enum: ['family', 'friend', 'community']
    },
    match_score: Number,
    predicted_relationship: String,
    match_reason: String
  },
  sent_at: {
    type: Date,
    default: Date.now
  },
  responded_at: Date,
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Compound index to prevent duplicate requests
friendRequestSchema.index({ sender_id: 1, recipient_id: 1 }, { unique: true });

// Index for efficient queries
friendRequestSchema.index({ recipient_id: 1, status: 1, created_at: -1 });
friendRequestSchema.index({ sender_id: 1, status: 1, created_at: -1 });

// Static method to check if a request exists
friendRequestSchema.statics.requestExists = async function(senderId, recipientId) {
  const existingRequest = await this.findOne({
    $or: [
      { sender_id: senderId, recipient_id: recipientId },
      { sender_id: recipientId, recipient_id: senderId }
    ],
    status: { $in: ['pending', 'accepted'] }
  });
  return existingRequest;
};

// Static method to get pending requests for a user
friendRequestSchema.statics.getPendingRequests = async function(userId) {
  return await this.find({
    recipient_id: userId,
    status: 'pending',
    expires_at: { $gt: new Date() }
  })
  .populate('sender_id', 'first_name last_name profile_photo_url location profession bio')
  .sort({ sent_at: -1 });
};

// Static method to get sent requests for a user
friendRequestSchema.statics.getSentRequests = async function(userId) {
  return await this.find({
    sender_id: userId,
    status: 'pending',
    expires_at: { $gt: new Date() }
  })
  .populate('recipient_id', 'first_name last_name profile_photo_url location profession bio')
  .sort({ sent_at: -1 });
};

// Instance method to accept request
friendRequestSchema.methods.accept = async function() {
  this.status = 'accepted';
  this.responded_at = new Date();
  await this.save();
  
  // Add to friends list in User model
  const User = mongoose.model('User');
  
  // Add each user to the other's friends list
  await User.findByIdAndUpdate(this.sender_id, {
    $addToSet: { friends: this.recipient_id }
  });
  
  await User.findByIdAndUpdate(this.recipient_id, {
    $addToSet: { friends: this.sender_id }
  });
  
  return this;
};

// Instance method to reject request
friendRequestSchema.methods.reject = async function() {
  this.status = 'rejected';
  this.responded_at = new Date();
  await this.save();
  return this;
};

// Instance method to cancel request (by sender)
friendRequestSchema.methods.cancel = async function() {
  this.status = 'cancelled';
  this.responded_at = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('FriendRequest', friendRequestSchema);