const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['bug', 'feature', 'improvement', 'general', 'compliment'],
    lowercase: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: false
  },
  device_info: {
    platform: String,
    version: String,
    model: String,
    os: String
  },
  app_version: {
    type: String,
    trim: true
  },
  include_logs: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed'],
    default: 'submitted'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  internal_notes: [{
    note: {
      type: String,
      required: true
    },
    added_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    added_at: {
      type: Date,
      default: Date.now
    }
  }],
  response: {
    message: String,
    responded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    responded_at: Date
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }]
}, {
  timestamps: true
});

// Indexes for performance
feedbackSchema.index({ user_id: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ assigned_to: 1, status: 1 });
feedbackSchema.index({ priority: 1, status: 1 });

// Text search index
feedbackSchema.index({
  subject: 'text',
  message: 'text',
  tags: 'text'
});

// Static methods
feedbackSchema.statics.getFeedbackByUser = async function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('assigned_to', 'first_name last_name email')
    .populate('response.responded_by', 'first_name last_name');
};

feedbackSchema.statics.getFeedbackByStatus = async function(status, limit = 100) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user_id', 'first_name last_name email')
    .populate('assigned_to', 'first_name last_name email');
};

feedbackSchema.statics.getFeedbackByType = async function(type, limit = 100) {
  return this.find({ type })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user_id', 'first_name last_name email');
};

feedbackSchema.statics.searchFeedback = async function(searchTerm) {
  return this.find({
    $text: { $search: searchTerm }
  }, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta: 'textScore' }
  }).populate('user_id', 'first_name last_name email');
};

feedbackSchema.statics.getFeedbackStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  const typeStats = await this.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);

  return { statusStats: stats, typeStats };
};

// Instance methods
feedbackSchema.methods.updateStatus = async function(newStatus, updatedBy) {
  this.status = newStatus;
  this.internal_notes.push({
    note: `Status changed to ${newStatus}`,
    added_by: updatedBy,
    added_at: new Date()
  });
  return this.save();
};

feedbackSchema.methods.addNote = async function(note, addedBy) {
  this.internal_notes.push({
    note,
    added_by: addedBy,
    added_at: new Date()
  });
  return this.save();
};

feedbackSchema.methods.respond = async function(responseMessage, respondedBy) {
  this.response = {
    message: responseMessage,
    responded_by: respondedBy,
    responded_at: new Date()
  };
  this.status = 'resolved';
  return this.save();
};

feedbackSchema.methods.assign = async function(assignedTo) {
  this.assigned_to = assignedTo;
  this.status = 'in_progress';
  this.internal_notes.push({
    note: `Assigned to ${assignedTo}`,
    added_by: assignedTo,
    added_at: new Date()
  });
  return this.save();
};

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;