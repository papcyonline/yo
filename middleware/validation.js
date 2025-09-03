const Joi = require('joi');

// Common validation patterns
const patterns = {
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  username: /^[a-zA-Z0-9_-]{3,30}$/,
  mongoId: /^[0-9a-fA-F]{24}$/
};

// Validation schemas
const schemas = {
  // Authentication schemas
  login: Joi.object({
    email: Joi.string().email().messages({
      'string.email': 'Please provide a valid email address'
    }),
    phone: Joi.string().pattern(patterns.phone).messages({
      'string.pattern.base': 'Please provide a valid phone number (e.g., +1234567890)'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required'
    })
  }).or('email', 'phone').messages({
    'object.missing': 'Either email or phone number is required'
  }),

  register: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().pattern(patterns.phone),
    first_name: Joi.string().min(1).max(50).trim().required().messages({
      'string.min': 'First name cannot be empty',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
    last_name: Joi.string().min(1).max(50).trim().required().messages({
      'string.min': 'Last name cannot be empty',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
    username: Joi.string().pattern(patterns.username).optional().messages({
      'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens'
    }),
    password: Joi.string().min(8).pattern(patterns.password).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
    confirm_password: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Password confirmation does not match password',
      'any.required': 'Password confirmation is required'
    }),
    date_of_birth: Joi.date().max('now').optional().messages({
      'date.max': 'Date of birth cannot be in the future'
    }),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
    terms_accepted: Joi.boolean().valid(true).required().messages({
      'any.only': 'You must accept the terms and conditions',
      'any.required': 'Terms acceptance is required'
    })
  }).or('email', 'phone'),

  // User profile schemas
  updateProfile: Joi.object({
    first_name: Joi.string().min(1).max(50).trim().optional(),
    last_name: Joi.string().min(1).max(50).trim().optional(),
    username: Joi.string().pattern(patterns.username).optional(),
    bio: Joi.string().max(500).optional().allow(''),
    location: Joi.string().max(100).optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    state: Joi.string().max(100).optional().allow(''),
    country: Joi.string().max(100).optional().allow(''),
    date_of_birth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
    interests: Joi.array().items(Joi.string().max(50)).max(20).optional(),
    languages: Joi.array().items(Joi.string().max(50)).max(10).optional()
  }),

  // Verification schemas
  verifyOTP: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().pattern(patterns.phone),
    code: Joi.string().length(6).pattern(/^\d{6}$/).required().messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required'
    })
  }).or('email', 'phone'),

  // Password reset schemas
  forgotPassword: Joi.object({
    email: Joi.string().email(),
    phone: Joi.string().pattern(patterns.phone)
  }).or('email', 'phone'),

  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    password: Joi.string().min(8).pattern(patterns.password).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'New password is required'
    }),
    confirm_password: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Password confirmation does not match password',
      'any.required': 'Password confirmation is required'
    })
  }),

  // Chat and message schemas
  sendMessage: Joi.object({
    chat_id: Joi.string().pattern(patterns.mongoId).required().messages({
      'string.pattern.base': 'Invalid chat ID format',
      'any.required': 'Chat ID is required'
    }),
    content: Joi.string().min(1).max(2000).required().messages({
      'string.min': 'Message cannot be empty',
      'string.max': 'Message cannot exceed 2000 characters',
      'any.required': 'Message content is required'
    }),
    message_type: Joi.string().valid('text', 'image', 'file', 'voice').default('text'),
    reply_to: Joi.string().pattern(patterns.mongoId).optional()
  }),

  createChat: Joi.object({
    participants: Joi.array().items(
      Joi.string().pattern(patterns.mongoId)
    ).min(1).max(50).required().messages({
      'array.min': 'At least one participant is required',
      'array.max': 'Maximum 50 participants allowed',
      'any.required': 'Participants list is required'
    }),
    chat_type: Joi.string().valid('direct', 'group').default('direct'),
    name: Joi.string().max(100).when('chat_type', {
      is: 'group',
      then: Joi.required(),
      otherwise: Joi.optional()
    }).messages({
      'any.required': 'Group name is required for group chats',
      'string.max': 'Chat name cannot exceed 100 characters'
    })
  }),

  // File upload schemas
  uploadFile: Joi.object({
    file_type: Joi.string().valid('image', 'document', 'avatar', 'cover_photo').required(),
    purpose: Joi.string().valid('profile', 'chat', 'post').optional()
  }),

  // Search schemas
  searchUsers: Joi.object({
    query: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required'
    }),
    filters: Joi.object({
      gender: Joi.string().valid('male', 'female', 'other').optional(),
      age_min: Joi.number().integer().min(13).max(120).optional(),
      age_max: Joi.number().integer().min(13).max(120).optional(),
      location: Joi.string().max(100).optional(),
      interests: Joi.array().items(Joi.string().max(50)).max(10).optional()
    }).optional(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  }),

  // Friend request schemas
  sendFriendRequest: Joi.object({
    user_id: Joi.string().pattern(patterns.mongoId).required().messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    }),
    message: Joi.string().max(200).optional().allow('')
  }),

  respondToFriendRequest: Joi.object({
    request_id: Joi.string().pattern(patterns.mongoId).required(),
    action: Joi.string().valid('accept', 'reject').required().messages({
      'any.only': 'Action must be either "accept" or "reject"',
      'any.required': 'Action is required'
    })
  }),

  // Pagination schemas
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().valid('created_at', '-created_at', 'updated_at', '-updated_at', 'name', '-name').default('-created_at')
  }),

  // Report/Safety schemas
  reportUser: Joi.object({
    reported_user_id: Joi.string().pattern(patterns.mongoId).required(),
    reason: Joi.string().valid('inappropriate_content', 'harassment', 'spam', 'fake_profile', 'other').required(),
    description: Joi.string().max(500).optional().allow(''),
    evidence_urls: Joi.array().items(Joi.string().uri()).max(5).optional()
  })
};

// Validation middleware factory
const validate = (schemaName, source = 'body') => {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) {
      return res.status(500).json({
        success: false,
        message: 'Validation schema not found',
        error: `Schema '${schemaName}' is not defined`
      });
    }

    const dataToValidate = source === 'query' ? req.query : 
                          source === 'params' ? req.params : 
                          req.body;

    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false, // Show all validation errors
      stripUnknown: true, // Remove unknown fields
      convert: true // Convert types (e.g., string to number)
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
      });
    }

    // Replace original data with validated and sanitized data
    if (source === 'query') {
      req.query = value;
    } else if (source === 'params') {
      req.params = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Custom validation functions
const validateMongoId = (req, res, next, id) => {
  if (!patterns.mongoId.test(id)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'The provided ID is not a valid MongoDB ObjectId'
    });
  }
  next();
};

// Middleware to validate file uploads
const validateFileUpload = (allowedTypes = [], maxSize = 10 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const files = req.files || [req.file];
    
    for (const file of files) {
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type',
          allowed_types: allowedTypes
        });
      }

      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum limit of ${maxSize / (1024 * 1024)}MB`
        });
      }
    }

    next();
  };
};

// Request sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove potentially dangerous characters from strings
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .trim();
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'string' ? sanitizeString(item) : sanitizeObject(item)
        );
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  
  next();
};

module.exports = {
  validate,
  schemas,
  patterns,
  validateMongoId,
  validateFileUpload,
  sanitizeInput
};