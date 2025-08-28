const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Optional authentication middleware - doesn't fail if no token, but sets req.userId if valid token exists
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.userId = null;
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from MongoDB
      const user = await User.findById(decoded.userId).select('-password_hash -refresh_token');
      
      if (user && user.is_active) {
        req.user = user;
        req.userId = user._id;
      }
    } catch (tokenError) {
      // Token is invalid but we don't fail the request
      console.log('Optional auth - invalid token:', tokenError.message);
      req.userId = null;
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
};

module.exports = optionalAuthMiddleware;