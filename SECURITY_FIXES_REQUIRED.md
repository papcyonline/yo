# 🚨 CRITICAL SECURITY FIXES REQUIRED

## IMMEDIATE ACTIONS (Do These First!)

### 1. Rotate All Compromised API Keys
Your API keys are exposed in the .env file. These need to be rotated immediately:

1. **OpenAI API Key**: Log into OpenAI dashboard and generate new key
2. **Twilio Credentials**: Reset in Twilio console
3. **Cloudinary Keys**: Generate new keys in Cloudinary dashboard
4. **MongoDB Password**: Change password in MongoDB Atlas
5. **JWT Secret**: Generate new secure secret

### 2. Environment Variables Security
```javascript
// Generate secure JWT secret
// Run this in Node.js console:
require('crypto').randomBytes(64).toString('hex')
```

### 3. Remove Hardcoded Secrets
Files to fix:
- `routes/auth/mongodb.js:35` - Remove `|| 'your-secret-key'`
- Check all files for hardcoded credentials

## HIGH PRIORITY FIXES

### 1. Input Validation
Add Joi validation to all routes:
```javascript
// middleware/validation.js
const Joi = require('joi');

const schemas = {
  login: Joi.object({
    email: Joi.string().email().when('phone', {
      is: Joi.exist(),
      then: Joi.optional(),
      otherwise: Joi.required()
    }),
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
    password: Joi.string().min(8).required()
  }),
  
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    first_name: Joi.string().min(2).max(50).required(),
    last_name: Joi.string().min(2).max(50).required()
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schemas[schema].validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }
    next();
  };
};

module.exports = validate;
```

### 2. Rate Limiting Enhancement
```javascript
// middleware/rateLimit.js - Add account lockout
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, account locked for 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    // Log security event
    console.error(`Potential brute force attack from IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Account temporarily locked due to multiple failed attempts'
    });
  }
});
```

### 3. Session Security
```javascript
// config/session.js
const session = require('express-session');
const MongoStore = require('connect-mongo');

module.exports = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: 'strict' // CSRF protection
  }
});
```

### 4. Password Security Enhancement
```javascript
// utils/passwordPolicy.js
const passwordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  const strength = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
    .filter(Boolean).length;
  
  if (strength < 3) {
    return { 
      valid: false, 
      message: 'Password must contain uppercase, lowercase, numbers, and special characters' 
    };
  }
  
  return { valid: true, strength };
};
```

### 5. File Upload Security
```javascript
// middleware/uploadSecurity.js
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const secureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  storage: secureStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // max 5 files at once
  }
});
```

## MEDIUM PRIORITY

### 1. Add Security Headers
```javascript
// middleware/security.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### 2. Implement Refresh Tokens
```javascript
// services/tokenService.js
const generateTokenPair = (userId) => {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

### 3. Add Audit Logging
```javascript
// services/auditService.js
const AuditLog = require('../models/AuditLog');

const logSecurityEvent = async (eventType, userId, details, ipAddress) => {
  await AuditLog.create({
    eventType,
    userId,
    details,
    ipAddress,
    timestamp: new Date()
  });
};
```

## Implementation Priority Order

1. **Day 1**: Rotate all API keys and secrets
2. **Day 2**: Implement input validation and fix hardcoded secrets
3. **Day 3**: Add session management and enhanced rate limiting
4. **Day 4**: Implement file upload security
5. **Week 2**: Add refresh tokens and audit logging
6. **Week 3**: Complete remaining security enhancements

## Testing Security Fixes

```bash
# Install security testing tools
npm install --save-dev helmet-csp eslint-plugin-security

# Run security audit
npm audit
npm audit fix

# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:9002/api/auth/login -d '{"email":"test@test.com","password":"wrong"}' -H "Content-Type: application/json"; done
```

## Monitoring & Alerts

Set up monitoring for:
- Failed login attempts > 5 in 15 minutes
- Unusual file upload patterns
- API key usage spikes
- Database connection failures
- JWT decode errors

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)