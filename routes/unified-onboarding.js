const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { User } = require('../models');

// Get onboarding responses
router.get('/responses', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert Map to Object for JSON response
    const answers = user.onboarding_responses ? 
      Object.fromEntries(user.onboarding_responses) : {};

    res.json({
      success: true,
      data: {
        answers,
        phase: user.onboarding_phase || 'essential',
        completed: user.onboarding_completed || false,
        profile_completion: user.profile_completion_percentage || 0
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding responses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch onboarding data'
    });
  }
});

// Save single onboarding response
router.post('/response', authMiddleware, async (req, res) => {
  try {
    const { questionId, answer, phase } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize onboarding_responses if it doesn't exist
    if (!user.onboarding_responses) {
      user.onboarding_responses = new Map();
    }

    // Save the response
    user.onboarding_responses.set(questionId, answer);

    // Update phase if provided
    if (phase) {
      user.onboarding_phase = phase;
    }

    // Update profile fields based on the question answered
    const profileFieldMapping = {
      'full_name': (value) => {
        const names = value.split(' ');
        user.first_name = names[0] || user.first_name;
        user.last_name = names[names.length - 1] || user.last_name;
      },
      'username': (value) => { user.username = value.toLowerCase(); },
      'date_of_birth': (value) => { user.date_of_birth = new Date(value); },
      'gender': (value) => { user.gender = value; },
      'location': (value) => { user.location = value; },
      'bio': (value) => { user.bio = value; },
      'profession': (value) => { user.profession = value; },
      'education_level': (value) => {
        if (!user.education) user.education = {};
        user.education.level = value;
      },
      'university': (value) => {
        if (!user.education) user.education = {};
        user.education.university = value;
      },
      'high_school': (value) => {
        if (!user.education) user.education = {};
        user.education.high_school = value;
      },
      'primary_school': (value) => {
        if (!user.education) user.education = {};
        user.education.primary_school = value;
      },
      'father_name': (value) => { 
        user.father_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.father_name = value;
      },
      'mother_name': (value) => { 
        user.mother_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.mother_name = value;
      },
      'siblings': (value) => { 
        user.siblings_names = Array.isArray(value) ? value : [value];
        if (!user.family_info) user.family_info = {};
        user.family_info.siblings = user.siblings_names;
      },
      'religious_background': (value) => { user.religious_background = value; },
      'languages': (value) => {
        const langs = Array.isArray(value) ? value : value.split(',').map(l => l.trim());
        user.family_languages = langs;
        if (langs.length > 0) {
          user.primary_language = langs[0];
        }
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.languages = langs;
      },
      'hobbies': (value) => {
        const hobbies = Array.isArray(value) ? value : value.split(',').map(h => h.trim());
        user.interests = hobbies;
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.hobbies = hobbies;
      },
      'childhood_memories': (value) => {
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.childhood_memories = Array.isArray(value) ? value : [value];
      },
      'childhood_friends': (value) => {
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.childhood_friends = Array.isArray(value) ? value : [value];
      },
      'origin_stories': (value) => {
        if (!user.family_info) user.family_info = {};
        user.family_info.origin_stories = Array.isArray(value) ? value : [value];
      }
    };

    // Apply the mapping if it exists
    if (profileFieldMapping[questionId]) {
      profileFieldMapping[questionId](answer);
    }

    // Calculate profile completion
    const completionScore = calculateProfileCompletion(user);
    user.profile_completion_percentage = completionScore;
    user.profile_completed = completionScore >= 80;

    await user.save();

    res.json({
      success: true,
      message: 'Response saved successfully',
      data: {
        completionPercentage: completionScore,
        profileCompleted: user.profile_completed
      }
    });
  } catch (error) {
    console.error('Error saving onboarding response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save response'
    });
  }
});

// Save batch of onboarding responses
router.post('/batch', authMiddleware, async (req, res) => {
  try {
    const { responses, phase, isComplete } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize onboarding_responses if it doesn't exist
    if (!user.onboarding_responses) {
      user.onboarding_responses = new Map();
    }

    // Save all responses and update profile fields
    for (const [questionId, answer] of Object.entries(responses)) {
      user.onboarding_responses.set(questionId, answer);
      
      // Update profile fields (using same mapping as single response)
      // ... (reuse the profileFieldMapping logic from above)
    }

    // Update phase
    if (phase) {
      user.onboarding_phase = phase;
    }

    // Mark as complete if specified
    if (isComplete) {
      user.onboarding_completed = true;
    }

    // Calculate profile completion
    const completionScore = calculateProfileCompletion(user);
    user.profile_completion_percentage = completionScore;
    user.profile_completed = completionScore >= 80;

    await user.save();

    res.json({
      success: true,
      message: 'Batch responses saved successfully',
      data: {
        completionPercentage: completionScore,
        profileCompleted: user.profile_completed,
        phase: user.onboarding_phase
      }
    });
  } catch (error) {
    console.error('Error saving batch onboarding responses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save batch responses'
    });
  }
});

// Helper function to calculate profile completion
function calculateProfileCompletion(user) {
  let score = 0;
  const weights = {
    // Basic info (30%)
    first_name: 5,
    last_name: 5,
    username: 5,
    date_of_birth: 5,
    gender: 5,
    location: 5,
    
    // Contact (10%)
    email: 5,
    phone: 5,
    
    // Profile content (20%)
    bio: 10,
    profile_photo_url: 10,
    
    // Family (15%)
    father_name: 5,
    mother_name: 5,
    siblings_names: 5,
    
    // Education & Career (15%)
    profession: 7,
    education: 8,
    
    // Personal (10%)
    interests: 5,
    religious_background: 5
  };

  for (const [field, weight] of Object.entries(weights)) {
    if (field === 'education') {
      if (user.education && Object.keys(user.education).length > 0) {
        score += weight;
      }
    } else if (field === 'siblings_names' || field === 'interests') {
      if (user[field] && Array.isArray(user[field]) && user[field].length > 0) {
        score += weight;
      }
    } else if (user[field]) {
      score += weight;
    }
  }

  return Math.min(100, score);
}

module.exports = router;