const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Display Preferences
  dark_mode: {
    type: Boolean,
    default: false
  },
  language: {
    type: String,
    default: 'en'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  
  // Notification Preferences
  notifications_enabled: {
    type: Boolean,
    default: true
  },
  email_notifications: {
    type: Boolean,
    default: true
  },
  push_notifications: {
    type: Boolean,
    default: true
  },
  sms_notifications: {
    type: Boolean,
    default: false
  },
  
  // Specific Notification Types
  match_notifications: {
    type: Boolean,
    default: true
  },
  message_notifications: {
    type: Boolean,
    default: true
  },
  friend_request_notifications: {
    type: Boolean,
    default: true
  },
  community_notifications: {
    type: Boolean,
    default: false
  },
  
  // Privacy Preferences
  privacy_level: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'friends'
  },
  location_enabled: {
    type: Boolean,
    default: true
  },
  show_online_status: {
    type: Boolean,
    default: true
  },
  show_last_seen: {
    type: Boolean,
    default: true
  },
  profile_visibility: {
    type: String,
    enum: ['public', 'friends', 'private'],
    default: 'public'
  },
  
  // Matching Preferences
  enable_auto_match: {
    type: Boolean,
    default: true
  },
  match_radius: {
    type: Number,
    default: 50 // km
  },
  age_range: {
    min: {
      type: Number,
      default: 18
    },
    max: {
      type: Number,
      default: 99
    }
  },
  preferred_match_types: [{
    type: String,
    enum: ['family', 'friends', 'professional', 'romantic']
  }],
  min_match_score: {
    type: Number,
    default: 10 // percentage
  },
  
  // Display Preferences
  compact_mode: {
    type: Boolean,
    default: false
  },
  show_avatars: {
    type: Boolean,
    default: true
  },
  font_size: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'medium'
  },
  
  // Other Preferences
  auto_play_media: {
    type: Boolean,
    default: false
  },
  sound_enabled: {
    type: Boolean,
    default: true
  },
  vibration_enabled: {
    type: Boolean,
    default: true
  },
  
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at timestamp on save
userPreferenceSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// user_id already has unique: true which creates an index

const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference;