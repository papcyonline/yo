const { User } = require('../../models');

// Get current user profile
const getProfile = async (req, res) => {
  try {
    console.log('🔍 Getting profile for user:', req.userId);
    
    const user = await User.findById(req.userId).select('-password_hash -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('✅ Profile retrieved successfully');
    
    res.json({
      success: true,
      data: { 
        user: user.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

// Update user profile (general)
const updateProfile = async (req, res) => {
  try {
    console.log('🔄 Profile update request received');
    console.log('User ID:', req.userId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const updates = { ...req.body };
    
    // Remove non-updatable fields
    delete updates.id;
    delete updates._id;
    delete updates.created_at;
    delete updates.email_verified;
    delete updates.phone_verified;
    delete updates.is_active;
    delete updates.password_hash;
    delete updates.refresh_token;

    // Handle special field mappings
    if (updates.full_name) {
      const nameParts = updates.full_name.split(' ');
      updates.first_name = nameParts[0] || '';
      updates.last_name = nameParts.slice(1).join(' ') || '';
      delete updates.full_name; // Remove the original field
      console.log('📝 Mapped full_name to first_name/last_name');
    }
    
    if (updates.fullName) {
      const nameParts = updates.fullName.split(' ');
      updates.first_name = nameParts[0] || '';
      updates.last_name = nameParts.slice(1).join(' ') || '';
      delete updates.fullName; // Remove the original field
      console.log('📝 Mapped fullName to first_name/last_name');
    }
    
    if (updates.current_address) {
      updates.location = updates.current_address;
      delete updates.current_address;
      console.log('📍 Mapped current_address to location');
    }
    
    if (updates.currentAddress) {
      updates.location = updates.currentAddress;
      delete updates.currentAddress;
      console.log('📍 Mapped currentAddress to location');
    }

    // Handle date formatting
    if (updates.dateOfBirth) {
      updates.date_of_birth = new Date(updates.dateOfBirth);
      delete updates.dateOfBirth;
    }
    
    if (updates.date_of_birth && typeof updates.date_of_birth === 'string') {
      updates.date_of_birth = new Date(updates.date_of_birth);
    }

    // Family information handling
    if (updates.fatherName) {
      if (!updates.family_info) updates.family_info = {};
      updates.family_info.father_name = updates.fatherName;
      delete updates.fatherName;
    }
    
    if (updates.motherName) {
      if (!updates.family_info) updates.family_info = {};
      updates.family_info.mother_name = updates.motherName;
      delete updates.motherName;
    }
    
    if (updates.placeOfBirth) {
      // Store in personal_info or create a dedicated field
      if (!updates.personal_info) updates.personal_info = {};
      updates.personal_info.place_of_birth = updates.placeOfBirth;
      delete updates.placeOfBirth;
    }

    console.log('✅ Final filtered updates:', JSON.stringify(updates, null, 2));

    // Check if user exists
    const existingUser = await User.findById(req.userId);
    if (!existingUser) {
      console.log('❌ User not found with ID:', req.userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('👤 User exists, proceeding with update...');

    // Update user using MongoDB's findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { 
        new: true, // Return updated document
        runValidators: true, // Run schema validators
        select: '-password_hash -refresh_token' // Exclude sensitive fields
      }
    );

    if (!updatedUser) {
      throw new Error('Failed to update user');
    }

    console.log('✅ Profile updated successfully!');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { 
        user: updatedUser.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Update basic information
const updateBasicInfo = async (req, res) => {
  try {
    const { firstName, lastName, username, dateOfBirth, gender, bio, location } = req.body;

    const updates = {};
    if (firstName) updates.first_name = firstName;
    if (lastName) updates.last_name = lastName;
    if (username) updates.username = username.toLowerCase();
    if (dateOfBirth) updates.date_of_birth = new Date(dateOfBirth);
    if (gender) updates.gender = gender;
    if (bio !== undefined) updates.bio = bio;
    if (location) updates.location = location;

    // Check if username is already taken (if provided)
    if (username) {
      const existingUser = await User.findOne({ 
        username: username.toLowerCase(),
        _id: { $ne: req.userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Basic information updated successfully',
      data: { user: user.toSafeJSON() }
    });

  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update basic information'
    });
  }
};

// Upload profile photo
const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo file provided'
      });
    }

    // Create full URL for local storage
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 9000}`;
    const photoUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

    // Update user profile with new photo URL
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          profile_picture_url: photoUrl,
          profile_photo_url: photoUrl
        }
      },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { 
        photoUrl,
        user: user.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('Upload photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo'
    });
  }
};

// Mark profile as complete
const markProfileComplete = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          profile_completed: true,
          profile_complete: true,
          profile_completed_at: new Date()
        }
      },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile marked as complete',
      data: { user: user.toSafeJSON() }
    });

  } catch (error) {
    console.error('Mark profile complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark profile as complete'
    });
  }
};

// Get profile completion status
const getCompletionStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const completionPercentage = user.calculateCompletionPercentage();
    
    res.json({
      success: true,
      data: {
        percentage: completionPercentage,
        isComplete: completionPercentage >= 90, // Require 90% completion
        user: user.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get completion status'
    });
  }
};

// Mark profile as complete via voice assistant
const markVoiceProfileComplete = async (req, res) => {
  try {
    console.log('🎤 Marking voice profile as complete for user:', req.userId);
    console.log('Voice completion data:', req.body);
    
    const { profileData, completedViaVoice = true } = req.body;
    
    const updates = {
      profile_completed: true,
      profile_completion_percentage: 100,
      voice_setup_completed: completedViaVoice,
      completed_at: new Date(),
      updated_at: new Date()
    };
    
    // If profile data is provided, merge it into the user profile
    if (profileData && typeof profileData === 'object') {
      Object.assign(updates, profileData);
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ Voice profile completion marked successfully');

    res.json({
      success: true,
      message: 'Profile completed via voice assistant',
      data: { user: user.toSafeJSON() }
    });

  } catch (error) {
    console.error('Mark voice profile complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark voice profile as complete'
    });
  }
};

// Get AI questionnaire answers
const getProgressiveAnswers = async (req, res) => {
  try {
    console.log('📋 Getting progressive answers for user:', req.userId);
    
    const user = await User.findById(req.userId).select('ai_questionnaire_responses ai_questionnaire_completed email username');
    
    if (!user) {
      console.log('❌ User not found for ID:', req.userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('👤 Found user:', user.email || user.username, 'ID:', user._id);
    
    // Get answers object for JSON response
    const answers = user.ai_questionnaire_responses || {};
    
    console.log('📝 Raw ai_questionnaire_responses:', user.ai_questionnaire_responses);
    console.log('📊 Processed answers:', answers);
    console.log('✅ Progressive answers retrieved:', Object.keys(answers).length, 'answers found');
    
    res.json({
      success: true,
      data: {
        answers,
        isCompleted: user.ai_questionnaire_completed || false
      }
    });

  } catch (error) {
    console.error('❌ Get progressive answers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progressive answers'
    });
  }
};

// Save AI questionnaire answer
const saveProgressiveAnswer = async (req, res) => {
  try {
    const { questionId, answer, points = 5 } = req.body;
    
    console.log('💾 Saving progressive answer:', { questionId, answer: answer?.substring(0, 50) + '...' });
    
    if (!questionId || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question ID and answer are required'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize the responses object if it doesn't exist
    if (!user.ai_questionnaire_responses) {
      user.ai_questionnaire_responses = {};
    }

    // Save the answer
    user.ai_questionnaire_responses[questionId] = answer;
    
    // Mark the field as modified for Mongoose
    user.markModified('ai_questionnaire_responses');
    
    // Auto-populate profile fields based on AI responses
    const fieldUpdates = await parseAndUpdateProfileFields(user, questionId, answer);
    
    // Apply field updates
    Object.assign(user, fieldUpdates);
    
    // Update points
    if (typeof points === 'number' && points > 0) {
      user.total_points = (user.total_points || 0) + points;
    }
    
    // Check if questionnaire should be marked as complete
    const answeredCount = Object.keys(user.ai_questionnaire_responses || {}).length;
    // Total questions from frontend flow (update this when questions change)
    const totalQuestions = 17; // Based on current smartQuestionFlow.ts
    const completionPercentage = (answeredCount / totalQuestions) * 100;
    
    // Mark as complete if 90% or more questions answered
    const wasJustCompleted = !user.ai_questionnaire_completed;
    if (completionPercentage >= 90 && !user.ai_questionnaire_completed) {
      user.ai_questionnaire_completed = true;
      user.questionnaire_completion_date = new Date();
      user.profile_completed = true;
      user.profile_complete = true;
      console.log('🎉 AI questionnaire marked as completed:', completionPercentage.toFixed(1) + '%');
    }
    
    await user.save();

    // Trigger AI matching when questionnaire is completed or enough responses collected
    if ((wasJustCompleted && user.ai_questionnaire_completed) || answeredCount >= 5) {
      try {
        const { enhancedMatchingService } = require('../../services/aiMatchingService');
        
        // Auto-trigger enhanced AI matching in the background
        enhancedMatchingService.findMatches(req.userId, {
          matchTypes: ['all'],
          maxResults: 50,
          minConfidence: 0.3
        }).catch(error => {
          console.error('Background AI matching error:', error);
        });
        
        console.log(`🧠 AI matching scheduled for questionnaire completion: ${req.userId}`);
      } catch (error) {
        console.error('Failed to schedule basic matching:', error);
      }
    }
    
    console.log('✅ Progressive answer saved and profile fields updated');
    
    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: {
        questionId,
        answer,
        updatedFields: fieldUpdates,
        totalPoints: user.total_points
      }
    });

  } catch (error) {
    console.error('Save progressive answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer'
    });
  }
};

// Helper function to parse AI responses and update profile fields
const parseAndUpdateProfileFields = async (user, questionId, answer) => {
  const updates = {};
  
  try {
    console.log('🔍 Parsing answer for field updates:', questionId);
    
    // Mapping AI question responses to profile fields
    const fieldMappings = {
      'father_name': 'family_info.father_name',
      'mother_name': 'family_info.mother_name',
      'personal_bio': 'bio',
      'date_of_birth': 'date_of_birth',
      'gender': 'gender',
      'location': 'location',
      'childhood_nickname': 'nickname',
      'profession': 'profession',
      'hobbies': 'interests',
      'religious_background': 'religious_background',
      'primary_school': 'education.primary_school',
      'secondary_school': 'education.high_school',
      'university_college': 'education.university'
    };
    
    if (fieldMappings[questionId]) {
      const fieldPath = fieldMappings[questionId];
      
      if (fieldPath.includes('.')) {
        // Handle nested fields
        const [parent, child] = fieldPath.split('.');
        if (!user[parent]) user[parent] = {};
        user[parent][child] = answer;
        console.log(`📝 Updated nested field: ${fieldPath} = ${answer?.substring(0, 50)}...`);
      } else {
        // Handle direct fields
        if (questionId === 'hobbies') {
          // Convert comma-separated hobbies to array
          updates[fieldPath] = answer.split(',').map(h => h.trim()).filter(h => h);
        } else if (questionId === 'date_of_birth') {
          updates[fieldPath] = new Date(answer);
        } else {
          updates[fieldPath] = answer;
        }
        console.log(`📝 Updated field: ${fieldPath} = ${answer?.substring(0, 50)}...`);
      }
    }
    
    // Special parsing for complex responses
    if (questionId === 'siblings_relatives' && answer) {
      // Try to extract family member names from the response
      const familyMatches = answer.match(/(brother|sister|sibling|cousin|uncle|aunt|nephew|niece):\s*([^\n,]+)/gi);
      if (familyMatches) {
        if (!user.family_info) user.family_info = {};
        user.family_info.siblings_info = answer;
        console.log('👨‍👩‍👧‍👦 Updated siblings info');
      }
    }
    
    if (questionId === 'family_stories' && answer) {
      if (!user.family_info) user.family_info = {};
      user.family_info.stories = answer;
      console.log('📖 Updated family stories');
    }
    
    return updates;
    
  } catch (error) {
    console.error('Error parsing profile fields:', error);
    return {};
  }
};

// Mark AI questionnaire as completed
const markQuestionnaireComplete = async (req, res) => {
  try {
    console.log('✅ Marking AI questionnaire as completed for user:', req.userId);
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          ai_questionnaire_completed: true,
          questionnaire_completion_date: new Date(),
          profile_completed: true,
          profile_complete: true
        }
      },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'AI questionnaire marked as completed',
      data: { user: user.toSafeJSON() }
    });

  } catch (error) {
    console.error('Mark questionnaire complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark questionnaire as complete'
    });
  }
};

// Save multiple progressive answers (batch)
const saveBatchAnswers = async (req, res) => {
  try {
    const { answers, autoSaved } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Answers object is required'
      });
    }

    console.log('💾 Saving batch answers:', answers);
    if (autoSaved) {
      console.log('🤖 Auto-saved from registration flow');
    }

    // Get current user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update AI questionnaire responses
    const currentResponses = user.ai_questionnaire_responses || {};
    
    // Add all answers to the responses
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer && String(answer).trim().length > 0) {
        currentResponses[questionId] = answer;
        console.log(`📝 Added response: ${questionId} = ${String(answer).substring(0, 50)}...`);
      }
    }

    // Prepare user updates
    const updates = {
      ai_questionnaire_responses: currentResponses,
      updated_at: new Date()
    };

    // If auto-saved from registration, also update main profile fields
    if (autoSaved) {
      if (answers.full_name) {
        const nameParts = answers.full_name.split(' ');
        updates.first_name = nameParts[0];
        updates.last_name = nameParts.slice(1).join(' ') || '';
      }
      if (answers.username) updates.username = answers.username;
      if (answers.date_of_birth) updates.date_of_birth = new Date(answers.date_of_birth);
      if (answers.gender) updates.gender = answers.gender;
      if (answers.location) updates.location = answers.location;
      if (answers.personal_bio) updates.bio = answers.personal_bio;
      if (answers.email) updates.email = answers.email;
      if (answers.phone) updates.phone = answers.phone;
    }

    // Apply field mappings for AI questionnaire responses
    const fieldMappings = {
      'father_name': 'family_info.father_name',
      'mother_name': 'family_info.mother_name',
      'personal_bio': 'bio',
      'childhood_nickname': 'nickname',
      'profession': 'profession',
      'hobbies': 'interests',
      'religious_background': 'religious_background'
    };
    
    for (const [questionId, answer] of Object.entries(answers)) {
      if (fieldMappings[questionId] && answer) {
        const fieldPath = fieldMappings[questionId];
        
        if (fieldPath.includes('.')) {
          // Handle nested fields
          const [parent, child] = fieldPath.split('.');
          if (!updates[parent]) updates[parent] = {};
          updates[parent][child] = answer;
        } else {
          // Handle direct fields
          updates[fieldPath] = answer;
        }
        console.log(`📝 Mapped field: ${questionId} → ${fieldPath}`);
      }
    }

    // Apply updates to the user object
    Object.assign(user, updates);
    
    // Save the user (this preserves Map objects properly)
    const updatedUser = await user.save();

    console.log('✅ Batch answers saved successfully');

    res.json({
      success: true,
      message: 'Batch answers saved successfully',
      data: {
        user: updatedUser.toSafeJSON(),
        answersCount: Object.keys(answers).length
      }
    });

  } catch (error) {
    console.error('❌ Save batch answers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save batch answers'
    });
  }
};

// Fix profile data - often called by frontend to ensure user data consistency
const fixProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`🔧 Profile fix requested for user: ${req.userId}`);
    
    // Return user as-is since our new calculation handles everything
    res.json({
      success: true,
      message: 'Profile checked',
      data: {
        user: user.toSafeJSON(),
        fixed: []
      }
    });

  } catch (error) {
    console.error('❌ Fix profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix profile'
    });
  }
};

// Get progressive questionnaire status
const getProgressiveStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const aiResponses = user.ai_questionnaire_responses || {};
    const totalQuestions = 18; // From smartQuestionFlow.ts
    const answeredCount = Object.keys(aiResponses).length;
    const completionPercentage = Math.round((answeredCount / totalQuestions) * 100);

    res.json({
      success: true,
      data: {
        answeredQuestions: Object.keys(aiResponses),
        totalQuestions,
        answeredCount,
        completionPercentage,
        isComplete: completionPercentage >= 90,
        phase: completionPercentage < 30 ? 'essential' : completionPercentage < 70 ? 'core' : 'rich'
      }
    });

  } catch (error) {
    console.error('❌ Get progressive status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progressive status'
    });
  }
};

// Debug endpoint to find user by email
const debugFindUser = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.json({ error: 'No email provided' });
    }
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return res.json({ found: false, email });
    }
    
    const answers = user.ai_questionnaire_responses || {};
    const answerCount = Object.keys(answers).length;
    
    res.json({
      found: true,
      userId: user._id,
      email: user.email,
      username: user.username,
      phone: user.phone,
      answersStored: answerCount,
      answers: answers,
      profileCompletion: user.profile_completion_percentage
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateBasicInfo,
  uploadPhoto,
  markProfileComplete,
  markVoiceProfileComplete,
  getCompletionStatus,
  getProgressiveAnswers,
  saveProgressiveAnswer,
  markQuestionnaireComplete,
  saveBatchAnswers,
  fixProfile,
  getProgressiveStatus,
  debugFindUser
};