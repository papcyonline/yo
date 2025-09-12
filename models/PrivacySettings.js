const mongoose = require('mongoose');

const privacySettingsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Profile Privacy
  profile_visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'friends'
  },
  show_online_status: {
    type: Boolean,
    default: true
  },
  show_last_seen: {
    type: Boolean,
    default: true
  },
  show_phone_number: {
    type: Boolean,
    default: false
  },
  show_email: {
    type: Boolean,
    default: true
  },
  
  // Communication Privacy
  allow_friend_requests: {
    type: Boolean,
    default: true
  },
  allow_message_requests: {
    type: Boolean,
    default: true
  },
  allow_tagging: {
    type: Boolean,
    default: true
  },
  
  // Location Privacy
  share_location: {
    type: Boolean,
    default: false
  },
  
  // Data & Analytics
  data_analytics: {
    type: Boolean,
    default: true
  },
  ad_personalization: {
    type: Boolean,
    default: false
  },
  
  // Additional settings
  allow_search_by_email: {
    type: Boolean,
    default: true
  },
  allow_search_by_phone: {
    type: Boolean,
    default: true
  },
  show_activity_status: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Create index for efficient user lookups
privacySettingsSchema.index({ user_id: 1 });

// Static method to get or create privacy settings for a user
privacySettingsSchema.statics.getOrCreate = async function(userId) {
  let privacySettings = await this.findOne({ user_id: userId });
  
  if (!privacySettings) {
    privacySettings = await this.create({
      user_id: userId,
      // Default values are defined in schema
    });
  }
  
  return privacySettings;
};

const PrivacySettings = mongoose.model('PrivacySettings', privacySettingsSchema);

module.exports = PrivacySettings;