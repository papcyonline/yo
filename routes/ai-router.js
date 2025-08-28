const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Get profile completion analysis
router.get('/profile-completion-analysis', authMiddleware, async (req, res) => {
  try {
    const { User } = require('../models');
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get actual completion percentage from user profile
    const completionScore = user.profile_completion_percentage || 0;
    const isComplete = user.profile_completed || false;
    
    // Dynamic suggestions based on missing fields
    const suggestions = [];
    const missingFields = [];
    
    if (!user.profile_photo_url && !user.profile_picture_url) {
      suggestions.push('Add a profile photo');
      missingFields.push('profile_photo_url');
    }
    
    if (!user.bio) {
      suggestions.push('Complete your bio');
      missingFields.push('bio');
    }
    
    if (!user.location) {
      suggestions.push('Add your location');
      missingFields.push('location');
    }
    
    if (!user.profession) {
      suggestions.push('Add your profession');
      missingFields.push('profession');
    }
    
    if (!user.interests || user.interests.length === 0) {
      suggestions.push('Add your interests');
      missingFields.push('interests');
    }
    
    // If no specific missing fields, suggest AI chat
    if (suggestions.length === 0 && completionScore < 80) {
      suggestions.push('Complete AI conversation for better matches');
      missingFields.push('ai_questionnaire');
    }

    console.log(`📊 Profile completion analysis for user ${req.userId}: ${completionScore}% complete`);

    res.json({
      success: true,
      data: {
        completionScore: completionScore,
        isComplete: isComplete,
        suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
        missingFields: missingFields,
        criticalMissing: missingFields
      }
    });
  } catch (error) {
    console.error('Error getting profile completion analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze profile completion'
    });
  }
});

// Get AI recommendations
router.get('/recommendations', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      recommendations: [],
      count: 0
    }
  });
});

// Get AI insights
router.get('/insights', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      insights: [],
      analytics: {}
    }
  });
});

module.exports = router;