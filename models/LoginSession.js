const mongoose = require('mongoose');
const { Schema } = mongoose;

const LoginSessionSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Session Information
  session_token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  refresh_token: {
    type: String,
    required: false,
    index: true
  },
  
  // Device and Location Information
  device_info: {
    type: {
      type: String, // 'mobile', 'desktop', 'tablet', 'unknown'
      default: 'unknown'
    },
    os: String, // 'iOS', 'Android', 'Windows', 'macOS', 'Linux'
    browser: String, // 'Safari', 'Chrome', 'Firefox', etc.
    version: String,
    model: String, // Device model if available
    fingerprint: String // Unique device fingerprint
  },
  
  // Network Information
  ip_address: {
    type: String,
    required: true
  },
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  
  // Session Status
  is_active: {
    type: Boolean,
    default: true,
    index: true
  },
  expires_at: {
    type: Date,
    required: true,
    index: true
  },
  
  // Login Details
  login_method: {
    type: String,
    enum: ['password', 'social', 'biometric', '2fa', 'sso'],
    default: 'password'
  },
  login_at: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  logout_at: {
    type: Date,
    default: null
  },
  
  // Activity Tracking
  last_activity: {
    type: Date,
    default: Date.now
  },
  activity_count: {
    type: Number,
    default: 1
  },
  
  // Security Flags
  is_suspicious: {
    type: Boolean,
    default: false
  },
  risk_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  security_warnings: [{
    type: String,
    message: String,
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Two-Factor Authentication
  two_factor_verified: {
    type: Boolean,
    default: false
  },
  two_factor_verified_at: {
    type: Date,
    default: null
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
LoginSessionSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

// Note: The user_id and expires_at indexes are defined in schema above
// Additional compound indexes for efficient queries
LoginSessionSchema.index({ user_id: 1, is_active: 1 });
LoginSessionSchema.index({ user_id: 1, login_at: -1 });
LoginSessionSchema.index({ ip_address: 1, login_at: -1 });

// Static method to create a new session
LoginSessionSchema.statics.createSession = async function(userId, sessionData) {
  const session = new this({
    user_id: userId,
    session_token: sessionData.session_token,
    refresh_token: sessionData.refresh_token,
    ip_address: sessionData.ip_address,
    device_info: sessionData.device_info || {},
    location: sessionData.location || {},
    login_method: sessionData.login_method || 'password',
    expires_at: sessionData.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
    two_factor_verified: sessionData.two_factor_verified || false
  });
  
  return await session.save();
};

// Static method to get active sessions for a user
LoginSessionSchema.statics.getActiveSessions = async function(userId) {
  return await this.find({
    user_id: userId,
    is_active: true,
    expires_at: { $gt: new Date() }
  }).sort({ last_activity: -1 });
};

// Static method to get login history for a user
LoginSessionSchema.statics.getLoginHistory = async function(userId, limit = 50) {
  return await this.find({
    user_id: userId
  })
  .sort({ login_at: -1 })
  .limit(limit)
  .select('ip_address location device_info login_at logout_at login_method is_suspicious');
};

// Method to update activity
LoginSessionSchema.methods.updateActivity = async function() {
  this.last_activity = new Date();
  this.activity_count += 1;
  await this.save();
};

// Method to terminate session
LoginSessionSchema.methods.terminate = async function(reason = 'user_logout') {
  this.is_active = false;
  this.logout_at = new Date();
  await this.save();
};

// Method to check if session is expired
LoginSessionSchema.methods.isExpired = function() {
  return new Date() > this.expires_at;
};

// Method to extend session expiration
LoginSessionSchema.methods.extend = async function(additionalMinutes = 60) {
  this.expires_at = new Date(this.expires_at.getTime() + additionalMinutes * 60 * 1000);
  await this.save();
};

// Method to flag as suspicious
LoginSessionSchema.methods.flagSuspicious = async function(reason, riskScore = 50) {
  this.is_suspicious = true;
  this.risk_score = Math.max(this.risk_score, riskScore);
  this.security_warnings.push({
    type: 'suspicious_activity',
    message: reason,
    timestamp: new Date()
  });
  await this.save();
};

// Static method to cleanup expired sessions
LoginSessionSchema.statics.cleanupExpiredSessions = async function() {
  const result = await this.deleteMany({
    $or: [
      { expires_at: { $lt: new Date() } },
      { is_active: false, logout_at: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // Keep inactive sessions for 30 days
    ]
  });
  
  return result.deletedCount;
};

// Virtual for session duration
LoginSessionSchema.virtual('duration').get(function() {
  const endTime = this.logout_at || new Date();
  return Math.floor((endTime - this.login_at) / 1000); // Duration in seconds
});

// Transform toJSON to include virtuals and format dates
LoginSessionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    // Format dates for frontend
    ret.login_at_formatted = ret.login_at?.toLocaleString();
    ret.last_activity_formatted = ret.last_activity?.toLocaleString();
    ret.logout_at_formatted = ret.logout_at?.toLocaleString();
    
    // Calculate time ago
    const now = new Date();
    const lastActivity = new Date(ret.last_activity);
    const diffMinutes = Math.floor((now - lastActivity) / (1000 * 60));
    
    if (diffMinutes < 1) {
      ret.last_activity_ago = 'Just now';
    } else if (diffMinutes < 60) {
      ret.last_activity_ago = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      ret.last_activity_ago = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      ret.last_activity_ago = `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    return ret;
  }
});

const LoginSession = mongoose.model('LoginSession', LoginSessionSchema);

module.exports = LoginSession;