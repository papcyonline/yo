const mongoose = require('mongoose');

const phoneVerificationSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true, 
    index: true 
  },
  code: { 
    type: String, 
    required: true 
  },
  first_name: { 
    type: String, 
    required: true 
  },
  last_name: { 
    type: String, 
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
phoneVerificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const PhoneVerification = mongoose.model('PhoneVerification', phoneVerificationSchema);

module.exports = PhoneVerification;