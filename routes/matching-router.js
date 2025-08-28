const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get family matches
router.get('/family', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      matches: [],
      count: 0,
      hasMore: false
    }
  });
});

// Get friend matches
router.get('/friends', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      matches: [],
      count: 0,
      hasMore: false
    }
  });
});

// Get love matches
router.get('/love', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      matches: [],
      count: 0,
      hasMore: false
    }
  });
});

// Get all matches
router.get('/all', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      matches: [],
      count: 0,
      hasMore: false
    }
  });
});

module.exports = router;