const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    lowercase: true,
    index: true 
  },
  code: { 
    type: String, 
    required: true 
  },
  password_hash: { 
    type: String, 
    required: true 
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true
  },
  expires_at: { 
    type: Date, 
    required: true
  },
  used: { 
    type: Boolean, 
    default: false 
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  }
});

// Auto-expire documents after expiry
emailVerificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const EmailVerification = mongoose.model('EmailVerification', emailVerificationSchema);

module.exports = EmailVerification;