const { User } = require('../../models');

// Save unified onboarding response
const saveOnboardingResponse = async (req, res) => {
  try {
    const { questionId, answer, phase } = req.body;

    if (!questionId || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question ID and answer are required'
      });
    }

    console.log(`💾 Saving unified onboarding response: ${questionId} = ${String(answer).substring(0, 50)}...`);

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update onboarding responses
    const onboardingResponses = user.onboarding_responses || new Map();
    onboardingResponses.set(questionId, answer);

    // Extract key data to user fields for easy querying/matching
    const updates = {
      onboarding_responses: onboardingResponses,
      updated_at: new Date()
    };

    // Update user phase if provided
    if (phase) {
      updates.onboarding_phase = phase;
    }

    // Extract critical data to dedicated fields for matching efficiency
    if (questionId === 'father_name' && answer) updates.father_name = answer;
    if (questionId === 'mother_name' && answer) updates.mother_name = answer;
    if (questionId === 'family_origin' && answer) updates.family_origin = answer;
    if (questionId === 'primary_language' && answer) updates.primary_language = answer;
    if (questionId === 'current_location' && answer) {
      updates.current_location = answer;
      updates.location = answer; // Legacy support
    }
    if (questionId === 'profession' && answer) updates.profession = answer;
    if (questionId === 'cultural_background' && answer) updates.cultural_background = answer;
    if (questionId === 'religious_background' && answer) updates.religious_background = answer;
    
    // Handle name fields
    if (questionId === 'full_name' && answer) {
      const nameParts = answer.split(' ');
      updates.first_name = nameParts[0] || '';
      updates.last_name = nameParts.slice(1).join(' ') || '';
      updates.full_name = answer;
    }
    
    // Handle other basic fields
    if (questionId === 'email' && answer) updates.email = answer;
    if (questionId === 'phone' && answer) updates.phone = answer;
    if (questionId === 'username' && answer) updates.username = answer;
    if (questionId === 'date_of_birth' && answer) updates.date_of_birth = new Date(answer);
    if (questionId === 'gender' && answer) updates.gender = answer;
    if (questionId === 'personal_bio' && answer) updates.bio = answer;
    if (questionId === 'childhood_nickname' && answer) updates.nickname = answer;
    
    // Handle array fields
    if (questionId === 'family_languages' && answer) {
      updates.family_languages = answer.split(',').map(lang => lang.trim()).filter(lang => lang);
    }
    if (questionId === 'previous_locations' && answer) {
      updates.previous_locations = answer.split(',').map(loc => loc.trim()).filter(loc => loc);
    }
    if (questionId === 'schools_attended' && answer) {
      updates.schools_attended = answer.split(',').map(school => school.trim()).filter(school => school);
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log(`✅ Onboarding response saved: ${questionId}`);

    res.json({
      success: true,
      message: 'Onboarding response saved successfully',
      data: {
        user: updatedUser.toSafeJSON(),
        completionPercentage: updatedUser.calculateCompletionPercentage()
      }
    });

  } catch (error) {
    console.error('❌ Save onboarding response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save onboarding response'
    });
  }
};

// Save multiple onboarding responses (batch)
const saveOnboardingBatch = async (req, res) => {
  try {
    const { answers, phase, autoSaved } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Answers object is required'
      });
    }

    console.log('💾 Saving unified onboarding batch:', Object.keys(answers));
    if (autoSaved) {
      console.log('🤖 Auto-saved from registration flow');
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update onboarding responses
    const onboardingResponses = user.onboarding_responses || new Map();
    
    const updates = {
      onboarding_responses: onboardingResponses,
      updated_at: new Date()
    };

    // Update phase if provided
    if (phase) {
      updates.onboarding_phase = phase;
    }

    // Process each answer
    for (const [questionId, answer] of Object.entries(answers)) {
      if (answer && String(answer).trim() !== '') {
        onboardingResponses.set(questionId, answer);
        console.log(`📝 Added: ${questionId} = ${String(answer).substring(0, 50)}...`);

        // Extract to dedicated fields (same logic as individual save)
        if (questionId === 'father_name') updates.father_name = answer;
        if (questionId === 'mother_name') updates.mother_name = answer;
        if (questionId === 'family_origin') updates.family_origin = answer;
        if (questionId === 'primary_language') updates.primary_language = answer;
        if (questionId === 'current_location') {
          updates.current_location = answer;
          updates.location = answer;
        }
        if (questionId === 'profession') updates.profession = answer;
        if (questionId === 'cultural_background') updates.cultural_background = answer;
        if (questionId === 'religious_background') updates.religious_background = answer;
        
        if (questionId === 'full_name') {
          const nameParts = answer.split(' ');
          updates.first_name = nameParts[0] || '';
          updates.last_name = nameParts.slice(1).join(' ') || '';
          updates.full_name = answer;
        }
        
        if (questionId === 'email') updates.email = answer;
        if (questionId === 'phone') updates.phone = answer;
        if (questionId === 'username') updates.username = answer;
        if (questionId === 'date_of_birth') updates.date_of_birth = new Date(answer);
        if (questionId === 'gender') updates.gender = answer;
        if (questionId === 'personal_bio') updates.bio = answer;
        if (questionId === 'childhood_nickname') updates.nickname = answer;
        
        if (questionId === 'family_languages') {
          updates.family_languages = answer.split(',').map(lang => lang.trim()).filter(lang => lang);
        }
        if (questionId === 'previous_locations') {
          updates.previous_locations = answer.split(',').map(loc => loc.trim()).filter(loc => loc);
        }
        if (questionId === 'schools_attended') {
          updates.schools_attended = answer.split(',').map(school => school.trim()).filter(school => school);
        }
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    console.log(`✅ Unified onboarding batch saved: ${Object.keys(answers).length} responses`);

    res.json({
      success: true,
      message: 'Onboarding batch saved successfully',
      data: {
        user: updatedUser.toSafeJSON(),
        answersCount: Object.keys(answers).length,
        completionPercentage: updatedUser.calculateCompletionPercentage()
      }
    });

  } catch (error) {
    console.error('❌ Save onboarding batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save onboarding batch'
    });
  }
};

// Get onboarding responses
const getOnboardingResponses = async (req, res) => {
  try {
    console.log('🔍 Getting onboarding responses for user:', req.userId);
    
    const user = await User.findById(req.userId).select('-password_hash -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get responses from BOTH systems for backward compatibility
    const onboardingResponses = user.onboarding_responses || {};
    const aiQuestionnaireResponses = user.ai_questionnaire_responses || {};
    
    // Merge both response sets, with onboarding taking precedence
    const allAnswers = {
      ...aiQuestionnaireResponses,
      ...onboardingResponses
    };
    
    console.log(`✅ Onboarding responses retrieved: ${Object.keys(onboardingResponses).length} onboarding + ${Object.keys(aiQuestionnaireResponses).length} AI = ${Object.keys(allAnswers).length} total answers`);
    
    res.json({
      success: true,
      data: {
        answers: allAnswers,
        phase: user.onboarding_phase || 'essential',
        completed: user.onboarding_completed || user.ai_questionnaire_completed || false,
        completionPercentage: user.calculateCompletionPercentage()
      }
    });

  } catch (error) {
    console.error('❌ Get onboarding responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding responses'
    });
  }
};

// Mark onboarding as complete
const completeOnboarding = async (req, res) => {
  try {
    const { phase } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          onboarding_phase: phase || 'completed',
          onboarding_completed: true,
          updated_at: new Date()
        } 
      },
      { new: true, runValidators: true }
    );

    console.log(`✅ Onboarding marked as complete for user: ${req.userId}`);

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        user: user.toSafeJSON(),
        completionPercentage: user.calculateCompletionPercentage()
      }
    });

  } catch (error) {
    console.error('❌ Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding'
    });
  }
};

// Get onboarding status and recommendations
const getOnboardingStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash -refresh_token');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const completionPercentage = user.calculateCompletionPercentage();
    const onboardingResponses = user.onboarding_responses || new Map();
    const answeredQuestions = Array.from(onboardingResponses.keys());

    // Determine what phase user should be in
    let recommendedPhase = 'essential';
    if (completionPercentage >= 60) recommendedPhase = 'core';
    if (completionPercentage >= 80) recommendedPhase = 'rich';

    res.json({
      success: true,
      data: {
        currentPhase: user.onboarding_phase || 'essential',
        recommendedPhase,
        completionPercentage,
        isComplete: completionPercentage >= 90,
        canUseApp: completionPercentage >= 40, // Minimum to start using app
        answeredCount: answeredQuestions.length,
        user: user.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('❌ Get onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding status'
    });
  }
};

module.exports = {
  saveOnboardingResponse,
  saveOnboardingBatch,
  getOnboardingResponses,
  completeOnboarding,
  getOnboardingStatus
};