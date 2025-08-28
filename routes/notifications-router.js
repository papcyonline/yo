const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get unread notification count
router.get('/unread-count', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      count: 0,
      chats: 0,
      friendRequests: 0,
      matches: 0,
      other: 0
    }
  });
});

// Get all notifications
router.get('/', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      notifications: [],
      count: 0,
      hasMore: false
    }
  });
});

// Mark notification as read
router.put('/:id/read', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Notification marked as read'
  });
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'All notifications marked as read'
  });
});

module.exports = router;