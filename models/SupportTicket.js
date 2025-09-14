const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  ticket_number: {
    type: String,
    unique: true,
    sparse: true // Allow null values for unique index
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  category: {
    type: String,
    required: true,
    enum: ['technical', 'account', 'billing', 'feature', 'bug', 'general'],
    lowercase: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
    default: 'open'
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  contact_email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  contact_phone: {
    type: String,
    trim: true
  },
  messages: [{
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sender_type: {
      type: String,
      enum: ['user', 'support'],
      required: true
    },
    sent_at: {
      type: Date,
      default: Date.now
    },
    is_internal: {
      type: Boolean,
      default: false
    },
    attachments: [{
      filename: String,
      url: String,
      type: String,
      size: Number
    }]
  }],
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  resolution: {
    summary: String,
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolved_at: Date,
    resolution_time: Number // minutes
  },
  satisfaction_rating: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    rated_at: Date
  },
  sla: {
    response_due: Date,
    resolution_due: Date,
    first_response_at: Date,
    is_overdue: {
      type: Boolean,
      default: false
    }
  },
  metadata: {
    source: {
      type: String,
      enum: ['app', 'web', 'email', 'phone', 'chat'],
      default: 'app'
    },
    device_info: {
      platform: String,
      version: String,
      model: String,
      os: String
    },
    app_version: String,
    user_agent: String
  }
}, {
  timestamps: true
});

// Indexes for performance
supportTicketSchema.index({ user_id: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });
supportTicketSchema.index({ assigned_to: 1, status: 1 });
supportTicketSchema.index({ priority: 1, status: 1 });
supportTicketSchema.index({ category: 1, status: 1 });
supportTicketSchema.index({ ticket_number: 1 }, { unique: true });

// Text search index
supportTicketSchema.index({
  subject: 'text',
  description: 'text',
  tags: 'text'
});

// Pre-save middleware to generate ticket number
supportTicketSchema.pre('save', async function(next) {
  if (!this.ticket_number) {
    try {
      const count = await this.constructor.countDocuments();
      this.ticket_number = `YF-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating ticket number:', error);
      // Fallback ticket number
      this.ticket_number = `YF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    }
  }

  // Ensure ticket_number is set before saving
  if (!this.ticket_number) {
    return next(new Error('Failed to generate ticket number'));
  }

  next();
});

// Static methods
supportTicketSchema.statics.getTicketsByUser = async function(userId, limit = 50) {
  return this.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('assigned_to', 'first_name last_name email')
    .select('-messages.is_internal');
};

supportTicketSchema.statics.getTicketsByStatus = async function(status, limit = 100) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user_id', 'first_name last_name email')
    .populate('assigned_to', 'first_name last_name email');
};

supportTicketSchema.statics.getTicketsByAssignee = async function(assigneeId, limit = 100) {
  return this.find({ assigned_to: assigneeId })
    .sort({ priority: -1, createdAt: -1 })
    .limit(limit)
    .populate('user_id', 'first_name last_name email');
};

supportTicketSchema.statics.searchTickets = async function(searchTerm) {
  return this.find({
    $text: { $search: searchTerm }
  }, {
    score: { $meta: 'textScore' }
  }).sort({
    score: { $meta: 'textScore' }
  }).populate('user_id', 'first_name last_name email');
};

supportTicketSchema.statics.getTicketStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgSatisfaction: { $avg: '$satisfaction_rating.rating' }
      }
    }
  ]);

  const priorityStats = await this.aggregate([
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 }
      }
    }
  ]);

  return { statusStats: stats, priorityStats };
};

// Instance methods
supportTicketSchema.methods.addMessage = async function(messageText, senderId, senderType, isInternal = false, attachments = []) {
  this.messages.push({
    message: messageText,
    sender_id: senderId,
    sender_type: senderType,
    sent_at: new Date(),
    is_internal: isInternal,
    attachments: attachments
  });

  // Update first response if this is from support
  if (senderType === 'support' && !this.sla.first_response_at) {
    this.sla.first_response_at = new Date();
  }

  return this.save();
};

supportTicketSchema.methods.updateStatus = async function(newStatus, updatedBy) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Add system message about status change
  await this.addMessage(
    `Ticket status changed from ${oldStatus} to ${newStatus}`,
    updatedBy,
    'support',
    true
  );

  return this.save();
};

supportTicketSchema.methods.assign = async function(assigneeId, assignedBy) {
  this.assigned_to = assigneeId;
  this.status = 'in_progress';

  await this.addMessage(
    `Ticket assigned to support agent`,
    assignedBy,
    'support',
    true
  );

  return this.save();
};

supportTicketSchema.methods.resolve = async function(resolutionSummary, resolvedBy) {
  this.status = 'resolved';
  this.resolution = {
    summary: resolutionSummary,
    resolved_by: resolvedBy,
    resolved_at: new Date(),
    resolution_time: Math.floor((new Date() - this.createdAt) / (1000 * 60)) // minutes
  };

  await this.addMessage(
    `Ticket resolved: ${resolutionSummary}`,
    resolvedBy,
    'support',
    false
  );

  return this.save();
};

supportTicketSchema.methods.rateSatisfaction = async function(rating, comment) {
  this.satisfaction_rating = {
    rating: rating,
    comment: comment || '',
    rated_at: new Date()
  };

  this.status = 'closed';
  return this.save();
};

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;