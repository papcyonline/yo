// middleware/testAuth.js - ONLY FOR TESTING VOICE ENDPOINTS
// Remove this file once you have proper authentication working

const testAuthMiddleware = (req, res, next) => {
  console.log('🧪 Using test auth middleware - FOR TESTING ONLY');
  
  // Create a mock user for testing
  req.user = {
    id: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User'
  };
  
  console.log('Mock user set:', req.user);
  next();
};

module.exports = { testAuthMiddleware };