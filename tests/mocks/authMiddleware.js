const jwt = require('jsonwebtoken');

const mockAuthMiddleware = (req, res, next) => {
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test_secret');
      req.user = decoded;
      req.userId = decoded.userId;
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }
};

module.exports = mockAuthMiddleware;