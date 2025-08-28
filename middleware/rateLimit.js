const rateLimit = require('express-rate-limit');

// General API rate limiting
const general = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Reasonable limit for production
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip, // Use user ID when available
  skip: (req) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/health' || req.path.startsWith('/uploads/');
  }
});

// Strict rate limiting for auth endpoints
const auth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 50 : 10, // 10 attempts for production, 50 for development
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || req.body?.phone || req.ip
});

// Very strict rate limiting for password reset and sensitive operations
const strict = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    success: false,
    message: 'Too many attempts for this sensitive operation, please try again later',
    code: 'STRICT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || req.userId || req.ip
});

// Rate limiting for AI processing endpoints
const aiProcessing = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI processing requests per hour per user
  message: {
    success: false,
    message: 'Too many AI processing requests, please try again later',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip // Use user ID for rate limiting
});

// Rate limiting for messaging endpoints
const messaging = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    success: false,
    message: 'You are sending messages too quickly, please slow down',
    code: 'MESSAGING_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

// Rate limiting for media uploads
const upload = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // 20 uploads per 10 minutes
  message: {
    success: false,
    message: 'Too many file uploads, please wait before uploading more',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

// Rate limiting for search and matching endpoints
const search = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 search requests per minute
  message: {
    success: false,
    message: 'Too many search requests, please slow down',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

// Rate limiting for reporting and safety actions
const safety = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 10, // 10 safety actions per 10 minutes
  message: {
    success: false,
    message: 'Too many safety actions, please wait before trying again',
    code: 'SAFETY_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

// Rate limiting for connection requests (friend requests, etc.)
const connections = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 connection requests per hour
  message: {
    success: false,
    message: 'Too many connection requests, please try again later',
    code: 'CONNECTION_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip
});

// Progressive rate limiting - stricter limits for suspicious behavior
const createProgressiveLimiter = (baseMax, windowMs = 15 * 60 * 1000) => {
  return rateLimit({
    windowMs,
    max: (req) => {
      // Check for suspicious patterns
      const userAgent = req.get('User-Agent') || '';
      const hasValidUserAgent = userAgent.length > 10 && !userAgent.includes('bot');
      
      // Reduce limits for suspicious requests
      if (!hasValidUserAgent || req.ip.startsWith('10.') === false) {
        return Math.floor(baseMax * 0.5); // 50% of normal limit
      }
      
      return baseMax;
    },
    message: (req) => ({
      success: false,
      message: 'Rate limit exceeded. Your request pattern appears suspicious.',
      code: 'PROGRESSIVE_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(windowMs / 1000)
    }),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip
  });
};

// Create progressive limiters
const progressiveGeneral = createProgressiveLimiter(1000);
const progressiveAuth = createProgressiveLimiter(10);

module.exports = {
  general,
  auth,
  strict,
  aiProcessing,
  messaging,
  upload,
  search,
  safety,
  connections,
  progressiveGeneral,
  progressiveAuth
};