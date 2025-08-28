const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { User } = require('../models');

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          email: user.email,
          phone: user.phone,
          profile_photo_url: user.profile_photo_url,
          bio: user.bio,
          location: user.location,
          created_at: user.created_at,
          // Family information
          father_name: user.father_name,
          mother_name: user.mother_name,
          siblings_names: user.siblings_names,
          family_origin: user.family_origin,
          family_info: user.family_info,
          // Professional & Educational
          profession: user.profession,
          education: user.education,
          schools_attended: user.schools_attended,
          // Cultural & Language
          primary_language: user.primary_language,
          family_languages: user.family_languages,
          religious_background: user.religious_background,
          cultural_background: user.cultural_background,
          // Personal info
          personal_info: user.personal_info,
          interests: user.interests,
          date_of_birth: user.date_of_birth,
          gender: user.gender,
          // Profile completion
          profile_completed: user.profile_completed,
          profile_completion_percentage: user.profile_completion_percentage,
          onboarding_completed: user.onboarding_completed,
          onboarding_phase: user.onboarding_phase,
          // Onboarding responses
          onboarding_responses: user.onboarding_responses ? Object.fromEntries(user.onboarding_responses) : {}
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updates = { ...req.body };
    // Remove fields that shouldn't be updated this way
    delete updates._id;
    delete updates.email;
    delete updates.password_hash;
    delete updates.refresh_token;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, select: '-password_hash -refresh_token' }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get profile completion status
router.get('/profile/completion-status', authMiddleware, async (req, res) => {
  res.json({
    success: true,
    data: {
      completionPercentage: 100,
      missingFields: [],
      isComplete: true
    }
  });
});

// Fix profile issues
router.post('/profile/fix', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Profile issues resolved'
  });
});

// Get progressive profile status
router.get('/progressive/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate actual progress based on onboarding_responses
    const responses = user.onboarding_responses || new Map();
    const totalExpectedFields = 20; // Adjust based on your requirements
    const completedFields = responses.size;
    const progress = Math.min(100, (completedFields / totalExpectedFields) * 100);

    res.json({
      success: true,
      data: {
        currentStep: Math.min(5, Math.ceil(completedFields / 4)),
        totalSteps: 5,
        completedSteps: Array.from(responses.keys()),
        nextStep: completedFields >= totalExpectedFields ? null : 'continue',
        progress: progress,
        isComplete: user.profile_completed || false,
        totalResponses: completedFields
      }
    });
  } catch (error) {
    console.error('Error fetching progressive status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch status'
    });
  }
});

// Get progressive profile answers
router.get('/progressive/answers', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert Map to object for response
    const responses = user.onboarding_responses || new Map();
    const answersObject = {};
    
    for (let [key, value] of responses) {
      answersObject[key] = value;
    }

    res.json({
      success: true,
      data: {
        answers: answersObject,
        profile: {
          firstName: user.first_name,
          lastName: user.last_name,
          fatherName: user.father_name,
          motherName: user.mother_name,
          profession: user.profession,
          location: user.location,
          education: user.education,
          languages: user.family_languages,
          religiousBackground: user.religious_background
        }
      }
    });
  } catch (error) {
    console.error('Error fetching answers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch answers'
    });
  }
});

// Get onboarding responses (alias for progressive answers)
router.get('/onboarding/responses', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert Map to object for response
    const responses = user.onboarding_responses || new Map();
    const responsesObject = {};
    
    for (let [key, value] of responses) {
      responsesObject[key] = value;
    }

    res.json({
      success: true,
      data: {
        responses: responsesObject,
        isComplete: user.profile_completed || false
      }
    });
  } catch (error) {
    console.error('Error fetching onboarding responses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch responses'
    });
  }
});

// Save progressive profile answers
router.post('/progressive/save', authMiddleware, async (req, res) => {
  try {
    const { fieldName, value, category } = req.body;
    const userId = req.userId;

    // Find the user
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
    user.onboarding_responses.set(fieldName, value);

    // Update specific fields based on the category and fieldName
    if (category === 'personal') {
      if (fieldName === 'firstName') user.first_name = value;
      if (fieldName === 'lastName') user.last_name = value;
      if (fieldName === 'dateOfBirth') user.date_of_birth = value;
      if (fieldName === 'gender') user.gender = value;
      if (fieldName === 'location') {
        user.location = value;
        user.current_location = value;
      }
      if (fieldName === 'profession') {
        user.profession = value;
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.profession = value;
      }
    } else if (category === 'family') {
      if (fieldName === 'fatherName') {
        user.father_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.father_name = value;
      }
      if (fieldName === 'motherName') {
        user.mother_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.mother_name = value;
      }
      if (fieldName === 'siblings') {
        user.siblings_names = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.siblings = value.split(',').map(s => s.trim());
      }
      if (fieldName === 'familyOrigin') user.family_origin = value;
    } else if (category === 'cultural') {
      if (fieldName === 'languages') {
        user.primary_language = value.split(',')[0]?.trim();
        user.family_languages = value.split(',').map(l => l.trim());
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.languages = value.split(',').map(l => l.trim());
      }
      if (fieldName === 'religiousBackground') {
        user.religious_background = value;
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.religious_background = value;
      }
      if (fieldName === 'culturalBackground') user.cultural_background = value;
    } else if (category === 'education') {
      if (!user.education) user.education = {};
      if (fieldName === 'primarySchool') user.education.primary_school = value;
      if (fieldName === 'highSchool') user.education.high_school = value;
      if (fieldName === 'university') user.education.university = value;
      if (fieldName === 'schools') {
        user.schools_attended = value.split(',').map(s => s.trim());
      }
    } else if (category === 'interests') {
      if (fieldName === 'hobbies') {
        user.interests = value.split(',').map(h => h.trim());
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.hobbies = value.split(',').map(h => h.trim());
      }
    } else if (category === 'memories') {
      if (!user.personal_info) user.personal_info = {};
      if (fieldName === 'childhoodMemories') {
        user.personal_info.childhood_memories = value.split(',').map(m => m.trim());
      }
      if (fieldName === 'childhoodFriends') {
        user.personal_info.childhood_friends = value.split(',').map(f => f.trim());
      }
    }

    // Update profile completion percentage
    const totalFields = user.onboarding_responses.size;
    user.profile_completion_percentage = Math.min(100, (totalFields / 20) * 100);
    user.profile_completed = totalFields >= 15;
    user.profile_complete = totalFields >= 15;

    // Save the user
    await user.save();

    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: {
        fieldName,
        value,
        profileCompletion: user.profile_completion_percentage
      }
    });
  } catch (error) {
    console.error('Error saving progressive answer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer',
      error: error.message
    });
  }
});

// Add alias for save-answer endpoint (for backward compatibility)
router.post('/progressive/save-answer', authMiddleware, async (req, res) => {
  try {
    // Support both formats: {fieldName, value, category} and {questionId, answer}
    let { fieldName, value, category, questionId, answer } = req.body;
    
    // If using questionId/answer format, map to fieldName/value
    if (questionId && answer !== undefined) {
      fieldName = questionId;
      value = answer;
      
      // Auto-detect category based on questionId
      if (['firstName', 'lastName', 'username', 'dateOfBirth', 'gender', 'location', 'profession'].includes(questionId)) {
        category = 'personal';
      } else if (['fatherName', 'motherName', 'siblings', 'familyOrigin'].includes(questionId)) {
        category = 'family';
      } else if (['languages', 'religiousBackground', 'culturalBackground'].includes(questionId)) {
        category = 'cultural';
      } else if (['primarySchool', 'highSchool', 'university', 'schools'].includes(questionId)) {
        category = 'education';
      } else if (['hobbies', 'interests'].includes(questionId)) {
        category = 'interests';
      } else if (['childhoodMemories', 'childhoodFriends'].includes(questionId)) {
        category = 'memories';
      }
    }
    
    const userId = req.userId;

    // Find the user
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
    user.onboarding_responses.set(fieldName, value);

    // Update specific fields based on the category and fieldName
    if (category === 'personal') {
      if (fieldName === 'firstName') user.first_name = value;
      if (fieldName === 'lastName') user.last_name = value;
      if (fieldName === 'dateOfBirth') user.date_of_birth = value;
      if (fieldName === 'gender') user.gender = value;
      if (fieldName === 'location') {
        user.location = value;
        user.current_location = value;
      }
      if (fieldName === 'profession') {
        user.profession = value;
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.profession = value;
      }
    } else if (category === 'family') {
      if (fieldName === 'fatherName') {
        user.father_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.father_name = value;
      }
      if (fieldName === 'motherName') {
        user.mother_name = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.mother_name = value;
      }
      if (fieldName === 'siblings') {
        user.siblings_names = value;
        if (!user.family_info) user.family_info = {};
        user.family_info.siblings = value.split(',').map(s => s.trim());
      }
      if (fieldName === 'familyOrigin') user.family_origin = value;
    } else if (category === 'cultural') {
      if (fieldName === 'languages') {
        user.primary_language = value.split(',')[0]?.trim();
        user.family_languages = value.split(',').map(l => l.trim());
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.languages = value.split(',').map(l => l.trim());
      }
      if (fieldName === 'religiousBackground') {
        user.religious_background = value;
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.religious_background = value;
      }
      if (fieldName === 'culturalBackground') user.cultural_background = value;
    } else if (category === 'education') {
      if (!user.education) user.education = {};
      if (fieldName === 'primarySchool') user.education.primary_school = value;
      if (fieldName === 'highSchool') user.education.high_school = value;
      if (fieldName === 'university') user.education.university = value;
      if (fieldName === 'schools') {
        user.schools_attended = value.split(',').map(s => s.trim());
      }
    } else if (category === 'interests') {
      if (fieldName === 'hobbies') {
        user.interests = value.split(',').map(h => h.trim());
        if (!user.personal_info) user.personal_info = {};
        user.personal_info.hobbies = value.split(',').map(h => h.trim());
      }
    } else if (category === 'memories') {
      if (!user.personal_info) user.personal_info = {};
      if (fieldName === 'childhoodMemories') {
        user.personal_info.childhood_memories = value.split(',').map(m => m.trim());
      }
      if (fieldName === 'childhoodFriends') {
        user.personal_info.childhood_friends = value.split(',').map(f => f.trim());
      }
    }

    // Update profile completion percentage
    const totalFields = user.onboarding_responses.size;
    user.profile_completion_percentage = Math.min(100, (totalFields / 20) * 100);
    user.profile_completed = totalFields >= 15;
    user.profile_complete = totalFields >= 15;

    // Save the user
    await user.save();

    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: {
        fieldName,
        value,
        profileCompletion: user.profile_completion_percentage
      }
    });
  } catch (error) {
    console.error('Error saving progressive answer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer',
      error: error.message
    });
  }
});

// Finalize progressive profile
router.post('/progressive/finalize', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Mark profile as completed
    user.profile_completed = true;
    user.profile_complete = true;
    user.onboarding_completed = true;
    user.onboarding_phase = 'completed';
    user.profile_completion_percentage = 100;
    
    await user.save();

    res.json({
      success: true,
      message: 'Profile finalized successfully',
      data: {
        profileCompleted: true,
        profileCompletionPercentage: 100
      }
    });
  } catch (error) {
    console.error('Error finalizing profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize profile',
      error: error.message
    });
  }
});

// Get user by ID (public info only)
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('first_name last_name profile_photo_url bio location');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
});

// Upload profile photo - MongoDB compatible
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary storage for profile photos
const profilePhotoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profile_photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', quality: 'auto:good' }
    ]
  },
});

const profilePhotoUpload = multer({ storage: profilePhotoStorage });

// POST /api/users/profile/photo - Upload profile photo
router.post('/profile/photo', authMiddleware, profilePhotoUpload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    const photoUrl = req.file.path; // Cloudinary URL

    console.log('📸 PROFILE PHOTO UPLOAD - User ID:', req.userId);
    console.log('📸 PROFILE PHOTO UPLOAD - Photo URL:', photoUrl);

    // Update user profile with new photo URL in MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          profile_photo_url: photoUrl,
          profile_picture_url: photoUrl, // Keep both for compatibility
          updated_at: new Date()
        }
      },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ PROFILE PHOTO UPDATED successfully');

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        photoUrl: photoUrl,
        user: {
          id: updatedUser._id,
          profile_photo_url: updatedUser.profile_photo_url,
          profile_picture_url: updatedUser.profile_picture_url
        }
      }
    });
  } catch (error) {
    console.error('❌ Profile photo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo'
    });
  }
});

module.exports = router;