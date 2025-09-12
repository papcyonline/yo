const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Post content
  content: {
    text: {
      type: String,
      maxlength: 2000,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'image', 'audio', 'text_with_image', 'text_with_audio', 'image_audio', 'text_with_image_audio'],
      required: true,
      default: 'text'
    },
    // Text styling options
    style: {
      background_color: {
        type: String,
        default: '#04a7c7',
        maxlength: 7 // hex color
      },
      font_size: {
        type: Number,
        default: 18,
        min: 12,
        max: 40
      },
      text_color: {
        type: String,
        default: '#FFFFFF',
        maxlength: 7 // hex color
      },
      font_family: {
        type: String,
        default: 'System',
        maxlength: 50
      },
      text_alignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'center'
      }
    }
  },
  
  // Media attachments
  media: {
    image_url: {
      type: String,
      maxlength: 500
    },
    image_public_id: {
      type: String, // For Cloudinary deletion
      maxlength: 200
    },
    thumbnail_url: {
      type: String,
      maxlength: 500
    },
    image_width: Number,
    image_height: Number,
    file_size: Number, // in bytes
    file_path: String, // Local temporary file path for cleanup
    created_at: { type: Date, default: Date.now }, // For cleanup scheduling
    // Audio fields
    audio_url: {
      type: String,
      maxlength: 500
    },
    audio_public_id: {
      type: String, // For Cloudinary deletion
      maxlength: 200
    },
    audio_duration: Number // in seconds
  },
  
  // Engagement metrics
  engagement: {
    likes: [{
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      created_at: {
        type: Date,
        default: Date.now
      }
    }],
    comments: [{
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      comment: {
        type: String,
        required: true,
        maxlength: 500,
        trim: true
      },
      created_at: {
        type: Date,
        default: Date.now
      }
    }],
    views: {
      type: Number,
      default: 0
    },
    viewers: [{
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      viewed_at: {
        type: Date,
        default: Date.now
      }
    }],
    shares: {
      type: Number,
      default: 0
    }
  },
  
  // Privacy and visibility
  visibility: {
    type: String,
    enum: ['public', 'friends', 'family', 'private'],
    default: 'friends'
  },
  
  // Location data (optional)
  location: {
    name: {
      type: String,
      maxlength: 100
    },
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  
  // Status metadata
  is_active: {
    type: Boolean,
    default: true
  },
  is_pinned: {
    type: Boolean,
    default: false
  },
  expires_at: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours by default
  },
  
  // Moderation
  is_flagged: {
    type: Boolean,
    default: false
  },
  moderation_status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
statusSchema.index({ user_id: 1, created_at: -1 });
statusSchema.index({ visibility: 1, created_at: -1 });
statusSchema.index({ is_active: 1, expires_at: 1 });
statusSchema.index({ 'engagement.likes.user_id': 1 });
statusSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Update timestamp on save
statusSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Virtual for like count
statusSchema.virtual('likeCount').get(function() {
  return this.engagement.likes.length;
});

statusSchema.virtual('commentCount').get(function() {
  return this.engagement.comments.length;
});

// Instance methods
statusSchema.methods.addLike = function(userId) {
  const existingLike = this.engagement.likes.find(like => 
    like.user_id.toString() === userId.toString()
  );
  
  if (!existingLike) {
    this.engagement.likes.push({ user_id: userId });
  }
  
  return this.save();
};

statusSchema.methods.removeLike = function(userId) {
  this.engagement.likes = this.engagement.likes.filter(like => 
    like.user_id.toString() !== userId.toString()
  );
  
  return this.save();
};

statusSchema.methods.addComment = function(userId, comment) {
  this.engagement.comments.push({
    user_id: userId,
    comment: comment
  });
  
  return this.save();
};

statusSchema.methods.incrementViews = function(viewerId = null) {
  // Track individual viewer if provided
  if (viewerId) {
    const alreadyViewed = this.engagement.viewers.some(viewer => 
      viewer.user_id && viewer.user_id.toString() === viewerId.toString()
    );
    
    if (!alreadyViewed) {
      this.engagement.viewers.push({ user_id: viewerId });
      this.engagement.views = this.engagement.viewers.length;
    }
  } else {
    // Just increment anonymous views
    this.engagement.views += 1;
  }
  
  return this.save();
};

statusSchema.methods.isVisibleTo = function(viewerUserId, viewerRelation = 'none') {
  if (this.visibility === 'public') return true;
  if (this.visibility === 'private' && this.user_id.toString() !== viewerUserId.toString()) return false;
  if (this.visibility === 'friends' && ['friend', 'family'].includes(viewerRelation)) return true;
  if (this.visibility === 'family' && viewerRelation === 'family') return true;
  
  return this.user_id.toString() === viewerUserId.toString();
};

statusSchema.methods.isExpired = function() {
  return this.expires_at && new Date() > this.expires_at;
};

// Static methods
statusSchema.statics.getStatusesByUser = function(userId, limit = 20, offset = 0) {
  return this.find({ 
    user_id: userId, 
    is_active: true,
    expires_at: { $gt: new Date() }
  })
  .populate('user_id', 'first_name last_name profile_photo_url')
  .populate('engagement.likes.user_id', 'first_name last_name')
  .populate('engagement.comments.user_id', 'first_name last_name')
  .sort({ is_pinned: -1, created_at: -1 })
  .limit(limit)
  .skip(offset);
};

statusSchema.statics.getFeedForUser = function(userId, visibleUserIds = [], limit = 20, offset = 0) {
  return this.find({
    $or: [
      { user_id: { $in: visibleUserIds } },
      { user_id: userId }
    ],
    is_active: true,
    expires_at: { $gt: new Date() },
    moderation_status: 'approved'
  })
  .populate('user_id', 'first_name last_name profile_photo_url')
  .populate('engagement.likes.user_id', 'first_name last_name')
  .populate('engagement.comments.user_id', 'first_name last_name')
  .sort({ created_at: -1 })
  .limit(limit)
  .skip(offset);
};

statusSchema.statics.getActiveStatuses = function() {
  return this.find({
    is_active: true,
    expires_at: { $gt: new Date() }
  });
};

// Additional static methods for testing
statusSchema.statics.findPublic = function() {
  return this.find({ visibility: 'public', is_active: true });
};

statusSchema.statics.findByUser = function(userId) {
  return this.find({ user_id: userId, is_active: true });
};

statusSchema.statics.findRecent = function(limit = 10) {
  return this.find({ is_active: true })
    .sort({ created_at: -1 })
    .limit(limit);
};

const Status = mongoose.model('Status', statusSchema);

module.exports = Status;