const { supabase } = require('../../config/database');

// Question flow definition (matches frontend smartQuestionFlow.ts)
const questionPhases = [
  {
    id: 'essential',
    name: 'Get Started',
    description: 'Just the basics to begin your journey',
    estimatedTime: '2-3 minutes',
    requiredPoints: 0,
    benefits: ['Create your profile', 'Start browsing'],
    questions: [
      // NOTE: full_name, username, date_of_birth, current_location are collected during registration
      // and should be automatically saved, so they're excluded from progressive profile questions
      {
        id: 'nickname',
        question: 'Do you have any nicknames?',
        placeholder: 'Enter your nicknames (optional)',
        type: 'text',
        field: 'nickname',
        required: false,
        phase: 'essential',
        category: 'personal',
        points: 5
      },
      {
        id: 'profile_image',
        question: 'Add your profile photo',
        placeholder: 'Upload your main profile picture',
        type: 'image',
        field: 'profile_picture_url',
        required: false,
        phase: 'essential',
        category: 'media',
        points: 15
      }
    ]
  }
  // Additional phases would be added here (core, rich)
];

// Get progressive profile status
const getProgressiveStatus = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw error;
    }

    // If no progressive profile exists, create one
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('progressive_profiles')
        .insert({
          user_id: req.userId,
          current_phase: 'essential',
          total_points: 0,
          answers: {},
          answered_questions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;

      return res.json({
        success: true,
        data: {
          profile: newProfile,
          currentPhase: getCurrentPhase(0),
          nextPhase: getNextPhase(0)
        }
      });
    }

    const currentPhase = getCurrentPhase(profile.total_points);
    const nextPhase = getNextPhase(profile.total_points);

    res.json({
      success: true,
      data: {
        profile,
        currentPhase,
        nextPhase
      }
    });

  } catch (error) {
    console.error('Get progressive status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get progressive status'
    });
  }
};

// Save a single answer
const saveAnswer = async (req, res) => {
  try {
    const { questionId, answer, points = 0 } = req.body;

    if (!questionId || answer === undefined || answer === null) {
      return res.status(400).json({
        success: false,
        message: 'Question ID and answer are required'
      });
    }

    // Get current progressive profile
    let { data: profile, error: getError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // If profile doesn't exist, create it
    if (getError && getError.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabase
        .from('progressive_profiles')
        .insert({
          user_id: req.userId,
          current_phase: 'essential',
          total_points: 0,
          answers: {},
          answered_questions: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create progressive profile:', createError);
        throw createError;
      }
      
      profile = newProfile;
    } else if (getError) {
      throw getError;
    }

    // Update answers and progress
    const updatedAnswers = { ...profile.answers, [questionId]: answer };
    const updatedQuestions = [...(profile.answered_questions || [])];
    
    if (!updatedQuestions.includes(questionId)) {
      updatedQuestions.push(questionId);
    }

    const newTotalPoints = profile.total_points + points;
    
    // Update answered_questions based on all answers with values
    const allAnsweredQuestions = Object.keys(updatedAnswers).filter(q => 
      updatedAnswers[q] && String(updatedAnswers[q]).trim().length > 0
    );
    
    // Calculate completion percentage
    const completionData = calculateProgressiveCompletion(allAnsweredQuestions, updatedAnswers);

    // Update progressive profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('progressive_profiles')
      .update({
        answers: updatedAnswers,
        answered_questions: allAnsweredQuestions,
        total_points: newTotalPoints,
        completion_percentage: completionData.percentage,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update main user profile if it's a basic field
    const question = findQuestionById(questionId);
    if (question && question.field) {
      await updateUserProfile(req.userId, question.field, answer);
    }

    const currentPhase = getCurrentPhase(newTotalPoints);
    const nextPhase = getNextPhase(newTotalPoints);

    res.json({
      success: true,
      message: 'Answer saved successfully',
      data: {
        profile: updatedProfile,
        pointsEarned: points,
        currentPhase,
        nextPhase
      }
    });

  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer'
    });
  }
};

// Get all answers for the user
const getAnswers = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('progressive_profiles')
      .select('answers, answered_questions, total_points, current_phase')
      .eq('user_id', req.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({
      success: true,
      data: {
        answers: profile?.answers || {},
        answeredQuestions: profile?.answered_questions || [],
        totalPoints: profile?.total_points || 0,
        currentPhase: profile?.current_phase || 'essential'
      }
    });

  } catch (error) {
    console.error('Get answers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get answers'
    });
  }
};

// Save multiple answers in batch
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

    // Get current progressive profile
    const { data: profile, error: getError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (getError) throw getError;

    // Calculate points for new answers
    let totalNewPoints = 0;
    const updatedAnswers = { ...profile.answers };
    const updatedQuestions = [...(profile.answered_questions || [])];

    for (const [questionId, answer] of Object.entries(answers)) {
      const question = findQuestionById(questionId);
      if (question && !updatedQuestions.includes(questionId)) {
        totalNewPoints += question.points || 0;
        updatedQuestions.push(questionId);
      }
      updatedAnswers[questionId] = answer;
    }

    const newTotalPoints = profile.total_points + totalNewPoints;
    
    // Update answered_questions based on all answers with values
    const allAnsweredQuestions = Object.keys(updatedAnswers).filter(q => 
      updatedAnswers[q] && String(updatedAnswers[q]).trim().length > 0
    );
    
    // Calculate completion percentage
    const completionData = calculateProgressiveCompletion(allAnsweredQuestions, updatedAnswers);

    // If this is auto-saved registration data, also update the main users table
    console.log('🔍 BATCH SAVE DEBUG:', { autoSaved, hasAnswers: !!answers, userId: req.userId });
    
    if (autoSaved && answers) {
      const userUpdates = {};
      
      // Map progressive profile fields to user table fields
      if (answers.full_name) {
        const nameParts = answers.full_name.split(' ');
        userUpdates.first_name = nameParts[0];
        userUpdates.last_name = nameParts.slice(1).join(' ') || nameParts[0];
      }
      if (answers.username) userUpdates.username = answers.username;
      if (answers.date_of_birth) userUpdates.date_of_birth = answers.date_of_birth;
      if (answers.gender) userUpdates.gender = answers.gender;
      if (answers.location) userUpdates.current_address = answers.location;
      
      console.log('🔍 USER UPDATES PREPARED:', userUpdates);
      
      if (Object.keys(userUpdates).length > 0) {
        userUpdates.updated_at = new Date().toISOString();
        
        console.log('📝 Updating users table with registration data:', userUpdates);
        console.log('📝 User ID:', req.userId);
        
        try {
          // Try updating individual fields one by one to bypass the ON CONFLICT issue
          console.log('🔄 Attempting individual field updates...');
          let successCount = 0;
          let totalFields = Object.keys(userUpdates).length - 1; // Exclude updated_at
          
          for (const [field, value] of Object.entries(userUpdates)) {
            if (field === 'updated_at') continue;
            
            try {
              console.log(`🔄 Updating ${field} = ${value}`);
              
              const { error: fieldError } = await supabase
                .from('users')
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq('id', req.userId);
              
              if (fieldError) {
                console.error(`❌ Failed to update ${field}:`, fieldError.message);
                
                // Try alternative field mapping if it's a mapping issue
                if (field === 'current_address') {
                  console.log(`🔄 Trying 'location' instead of 'current_address'...`);
                  const { error: altError } = await supabase
                    .from('users')
                    .update({ location: value, updated_at: new Date().toISOString() })
                    .eq('id', req.userId);
                  
                  if (!altError) {
                    console.log(`✅ Successfully updated location field`);
                    successCount++;
                  } else {
                    console.error(`❌ Failed to update location too:`, altError.message);
                  }
                }
              } else {
                console.log(`✅ Successfully updated ${field}`);
                successCount++;
              }
            } catch (err) {
              console.error(`❌ Exception updating ${field}:`, err.message);
            }
          }
          
          console.log(`📊 Successfully updated ${successCount}/${totalFields} fields`);
          
          if (successCount > 0) {
            // Verify the updates by checking the user data
            const { data: verifyResult } = await supabase
              .from('users')
              .select('first_name, last_name, username, date_of_birth, gender, current_address, location')
              .eq('id', req.userId)
              .single();
            
            console.log('✅ Verified updated user data:', verifyResult);
          }
          
        } catch (updateException) {
          console.error('❌ Exception during users table update:', updateException);
        }
      } else {
        console.log('⚠️ No user updates to apply');
      }
    } else {
      console.log('⚠️ Skipping users table update - autoSaved:', autoSaved, 'answers:', !!answers);
    }

    // Update progressive profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('progressive_profiles')
      .update({
        answers: updatedAnswers,
        answered_questions: allAnsweredQuestions,
        total_points: newTotalPoints,
        completion_percentage: completionData.percentage,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update main user profile for basic fields
    for (const [questionId, answer] of Object.entries(answers)) {
      const question = findQuestionById(questionId);
      if (question && question.field) {
        await updateUserProfile(req.userId, question.field, answer);
      }
    }

    const currentPhase = getCurrentPhase(newTotalPoints);
    const nextPhase = getNextPhase(newTotalPoints);

    res.json({
      success: true,
      message: 'Batch answers saved successfully',
      data: {
        profile: updatedProfile,
        pointsEarned: totalNewPoints,
        currentPhase,
        nextPhase
      }
    });

  } catch (error) {
    console.error('Save batch answers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save batch answers'
    });
  }
};

// Complete a phase
const completePhase = async (req, res) => {
  try {
    const { phaseId } = req.body;

    const { data: profile, error: updateError } = await supabase
      .from('progressive_profiles')
      .update({
        current_phase: phaseId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: 'Phase completed successfully',
      data: { profile }
    });

  } catch (error) {
    console.error('Complete phase error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete phase'
    });
  }
};

// Finalize progressive profile
const finalizeProfile = async (req, res) => {
  try {
    // Get current progressive profile with all answers
    const { data: profile, error: getError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (getError) throw getError;

    // Sync all progressive profile answers to main user record
    if (profile.answers && Object.keys(profile.answers).length > 0) {
      console.log('Syncing progressive profile answers to main user record...');
      
      for (const [questionId, answer] of Object.entries(profile.answers)) {
        const question = findQuestionById(questionId);
        if (question && question.field) {
          await updateUserProfile(req.userId, question.field, answer);
        }
      }
    }

    // Mark progressive profile as completed
    const { data: updatedProfile, error: updateError } = await supabase
      .from('progressive_profiles')
      .update({
        completed_at: new Date().toISOString(),
        completion_percentage: 100,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', req.userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Get updated user data to calculate final completion
    const { data: currentUser, error: getUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (getUserError) throw getUserError;

    // Calculate completion using the enhanced calculator
    const userController = require('./index');
    const completionData = userController.calculateProfileCompletion ? 
      userController.calculateProfileCompletion(currentUser) : 
      { percentage: 100, isComplete: true };

    // Mark main profile as completed with calculated completion percentage
    const { data: user, error: userUpdateError } = await supabase
      .from('users')
      .update({
        profile_completed: true,
        profile_complete: true,
        profile_completion_percentage: completionData.percentage,
        profile_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (userUpdateError) throw userUpdateError;

    res.json({
      success: true,
      message: 'Progressive profile finalized successfully',
      data: { 
        profile: updatedProfile, 
        user: {
          ...user,
          completionPercentage: completionData.percentage,
          profileCompleted: true
        },
        completionData
      }
    });

  } catch (error) {
    console.error('Finalize profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finalize profile',
      error: error.message
    });
  }
};

// Get question flow
const getQuestionFlow = async (req, res) => {
  try {
    res.json({
      success: true,
      data: { questionPhases }
    });
  } catch (error) {
    console.error('Get question flow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get question flow'
    });
  }
};

// Sync progressive profile data to main user profile
const syncToMainProfile = async (req, res) => {
  try {
    // Get current progressive profile
    const { data: profile, error: getError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    if (getError) {
      return res.status(404).json({
        success: false,
        message: 'Progressive profile not found'
      });
    }

    let syncedFields = 0;
    const syncErrors = [];

    // Sync all answers to main profile
    if (profile.answers && Object.keys(profile.answers).length > 0) {
      console.log(`Syncing ${Object.keys(profile.answers).length} progressive answers to main profile...`);
      
      for (const [questionId, answer] of Object.entries(profile.answers)) {
        try {
          const question = findQuestionById(questionId);
          if (question && question.field) {
            await updateUserProfile(req.userId, question.field, answer);
            syncedFields++;
          }
        } catch (error) {
          console.error(`Error syncing field ${questionId}:`, error);
          syncErrors.push({ questionId, error: error.message });
        }
      }
    }

    // Get updated user data and calculate completion
    const { data: updatedUser, error: getUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (getUserError) throw getUserError;

    // Calculate new completion percentage
    const userController = require('./index');
    const completionData = userController.calculateProfileCompletion ? 
      userController.calculateProfileCompletion(updatedUser) : 
      { percentage: 0, isComplete: false };

    // Update user's completion percentage
    await supabase
      .from('users')
      .update({
        profile_completion_percentage: completionData.percentage,
        profile_completed: completionData.isComplete,
        profile_complete: completionData.isComplete,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId);

    res.json({
      success: true,
      message: `Successfully synced ${syncedFields} fields to main profile`,
      data: {
        syncedFields,
        totalAnswers: Object.keys(profile.answers || {}).length,
        syncErrors,
        completionData,
        user: {
          ...updatedUser,
          completionPercentage: completionData.percentage,
          profileCompleted: completionData.isComplete
        }
      }
    });

  } catch (error) {
    console.error('Sync to main profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync progressive profile data',
      error: error.message
    });
  }
};

// Helper functions
const getCurrentPhase = (currentPoints) => {
  const phases = [...questionPhases].reverse();
  return phases.find(phase => currentPoints >= phase.requiredPoints) || questionPhases[0];
};

const getNextPhase = (currentPoints) => {
  return questionPhases.find(phase => phase.requiredPoints > currentPoints) || null;
};

const findQuestionById = (questionId) => {
  for (const phase of questionPhases) {
    const question = phase.questions.find(q => q.id === questionId);
    if (question) return question;
  }
  return null;
};

// Calculate completion percentage based on answered questions
const calculateProgressiveCompletion = (answeredQuestions, answers) => {
  // Define all possible questions across all phases
  const allQuestions = [
    'nickname', 'profile_image', 'personal_bio', 'date_of_birth', 'gender', 'location',
    'father_name', 'mother_name', 'siblings_relatives', 'family_stories', 'family_traditions',
    'childhood_memories', 'kindergarten_memories', 'childhood_friends', 'hobbies',
    'languages_dialects', 'religious_background', 'profession',
    'primary_school', 'secondary_school', 'university_college', 'educational_background'
  ];
  
  // Count answered questions that have actual values
  const answeredCount = allQuestions.filter(q => 
    answeredQuestions.includes(q) && 
    answers[q] && 
    String(answers[q]).trim().length > 0
  ).length;
  
  const totalQuestions = allQuestions.length;
  const percentage = Math.round((answeredCount / totalQuestions) * 100);
  
  return {
    percentage,
    answeredCount,
    totalQuestions,
    isComplete: percentage >= 85 // Consider 85% as complete
  };
};

const updateUserProfile = async (userId, field, value) => {
  try {
    const updates = { updated_at: new Date().toISOString() };
    
    // Map progressive fields to user table fields and JSONB fields
    const fieldMapping = {
      // Direct field mappings
      'full_name': 'full_name',
      'username': 'username', 
      'date_of_birth': 'date_of_birth',
      'location': 'current_address',
      'childhood_nickname': 'nickname',
      'profile_picture_url': 'profile_picture_url',
      'personal_bio': 'bio',
      'gender': 'gender',
      'phone': 'phone',
      'email': 'email'
    };

    // JSONB field mappings for structured data
    const jsonbFieldMapping = {
      // Family info fields
      'father_name': { table: 'family_info', key: 'father_name' },
      'mother_name': { table: 'family_info', key: 'mother_name' },
      'siblings_relatives': { table: 'family_info', key: 'siblings' },
      'family_stories': { table: 'family_info', key: 'origin_stories' },
      'family_traditions': { table: 'family_info', key: 'traditions' },
      'grandfather_stories': { table: 'family_info', key: 'grandfather_stories' },
      'grandmother_stories': { table: 'family_info', key: 'grandmother_stories' },
      'uncle_stories': { table: 'family_info', key: 'uncle_stories' },
      'aunt_stories': { table: 'family_info', key: 'aunt_stories' },
      
      // Personal info fields
      'childhood_memories': { table: 'personal_info', key: 'childhood_memories' },
      'kindergarten_memories': { table: 'personal_info', key: 'kindergarten_memories' },
      'childhood_friends': { table: 'personal_info', key: 'childhood_friends' },
      'hobbies': { table: 'personal_info', key: 'hobbies' },
      'languages_dialects': { table: 'personal_info', key: 'languages' },
      'religious_background': { table: 'personal_info', key: 'religious_background' },
      'profession': { table: 'personal_info', key: 'profession' },
      
      // Education info fields
      'primary_school': { table: 'education', key: 'primary_school' },
      'secondary_school': { table: 'education', key: 'high_school' },
      'university_college': { table: 'education', key: 'university' },
      'educational_background': { table: 'education', key: 'background' }
    };

    // Handle direct field updates
    if (fieldMapping[field]) {
      updates[fieldMapping[field]] = value;
    }
    
    // Handle JSONB field updates
    if (jsonbFieldMapping[field]) {
      const mapping = jsonbFieldMapping[field];
      
      // Get current JSONB data
      const { data: currentUser } = await supabase
        .from('users')
        .select(mapping.table)
        .eq('id', userId)
        .single();
      
      const currentData = currentUser?.[mapping.table] || {};
      const updatedData = { ...currentData, [mapping.key]: value };
      updates[mapping.table] = updatedData;
    }

    // Only update if we have something to update
    if (Object.keys(updates).length > 1) { // More than just updated_at
      await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);
    }
  } catch (error) {
    console.error('Update user profile error:', error);
    // Don't throw - this is supplementary
  }
};

module.exports = {
  getProgressiveStatus,
  saveAnswer,
  getAnswers,
  saveBatchAnswers,
  completePhase,
  finalizeProfile,
  getQuestionFlow,
  syncToMainProfile
};