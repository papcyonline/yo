const mongoose = require('mongoose');
const { Schema } = mongoose;

const SecuritySettingsSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Two-Factor Authentication
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: {
    type: String, // For TOTP secret storage
    default: null
  },
  two_factor_backup_codes: [{
    code: String,
    used: { type: Boolean, default: false },
    used_at: Date
  }],
  
  // Biometric/Device Authentication
  biometric_enabled: {
    type: Boolean,
    default: false
  },
  trusted_devices: [{
    device_id: String,
    device_name: String,
    added_at: { type: Date, default: Date.now },
    last_used: Date
  }],
  
  // Login Alerts and Monitoring
  login_alerts: {
    type: Boolean,
    default: true
  },
  login_notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true }
  },
  
  // Session Management
  session_timeout: {
    type: Number,
    default: 30, // minutes, -1 for never
    validate: {
      validator: function(v) {
        return v === -1 || v >= 0;
      },
      message: 'Session timeout must be -1 (never) or a positive number'
    }
  },
  max_concurrent_sessions: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  
  // Password Settings
  password_changed_at: {
    type: Date,
    default: Date.now
  },
  require_password_change: {
    type: Boolean,
    default: false
  },
  password_change_interval: {
    type: Number,
    default: 90 // days, 0 for never
  },
  
  // Account Recovery
  recovery_email: {
    type: String,
    trim: true,
    lowercase: true
  },
  recovery_phone: {
    type: String,
    trim: true
  },
  security_questions: [{
    question: String,
    answer_hash: String, // hashed answer
    created_at: { type: Date, default: Date.now }
  }],
  
  // Security Monitoring
  failed_login_attempts: {
    type: Number,
    default: 0
  },
  account_locked: {
    type: Boolean,
    default: false
  },
  locked_until: {
    type: Date,
    default: null
  },
  
  // Privacy and Data Settings
  data_retention_days: {
    type: Number,
    default: 365
  },
  activity_logging: {
    type: Boolean,
    default: true
  },
  
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at field before saving
SecuritySettingsSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Static method to get or create security settings for a user
SecuritySettingsSchema.statics.getOrCreate = async function(userId) {
  let settings = await this.findOne({ user_id: userId });
  if (!settings) {
    settings = await this.create({
      user_id: userId,
      // Default settings will be applied by schema defaults
    });
  }
  return settings;
};

// Method to check if 2FA is properly configured
SecuritySettingsSchema.methods.isTwoFactorSetup = function() {
  return this.two_factor_enabled && this.two_factor_secret;
};

// Method to generate backup codes
SecuritySettingsSchema.methods.generateBackupCodes = function(count = 10) {
  const crypto = require('crypto');
  const codes = [];
  
  for (let i = 0; i < count; i++) {
    codes.push({
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      used: false
    });
  }
  
  this.two_factor_backup_codes = codes;
  return codes;
};

// Method to check if account is locked
SecuritySettingsSchema.methods.isAccountLocked = function() {
  if (!this.account_locked) return false;
  if (!this.locked_until) return true;
  
  const now = new Date();
  if (now > this.locked_until) {
    // Auto-unlock expired locks
    this.account_locked = false;
    this.locked_until = null;
    this.failed_login_attempts = 0;
    return false;
  }
  
  return true;
};

// Method to handle failed login attempt
SecuritySettingsSchema.methods.recordFailedLogin = async function() {
  this.failed_login_attempts += 1;
  
  // Lock account after 5 failed attempts
  if (this.failed_login_attempts >= 5) {
    this.account_locked = true;
    this.locked_until = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
  }
  
  await this.save();
};

// Method to reset failed login attempts
SecuritySettingsSchema.methods.resetFailedLogins = async function() {
  this.failed_login_attempts = 0;
  this.account_locked = false;
  this.locked_until = null;
  await this.save();
};

const SecuritySettings = mongoose.model('SecuritySettings', SecuritySettingsSchema);

module.exports = SecuritySettings;