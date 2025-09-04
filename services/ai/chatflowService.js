const { User } = require('../../models');
const { updateUserProfileCompletion } = require('../profileCompletionCalculator');

// Complete question flow with all profile fields - MongoDB version
const profileQuestions = [
  // Essential Information (Phase 1)
  {
    id: 'full_name',
    question: "What's your full name?",
    field: 'full_name',
    phase: 'essential',
    category: 'personal',
    required: true,
    type: 'text',
    points: 10
  },
  {
    id: 'date_of_birth',
    question: "When were you born? (YYYY-MM-DD)",
    field: 'date_of_birth',
    phase: 'essential',
    category: 'personal',
    required: true,
    type: 'date',
    points: 10
  },
  {
    id: 'current_location',
    question: "Where do you currently live?",
    field: 'current_address',
    phase: 'essential',
    category: 'personal',
    required: true,
    type: 'text',
    points: 10
  },
  {
    id: 'place_of_birth',
    question: "Where were you born?",
    field: 'place_of_birth',
    phase: 'essential',
    category: 'personal',
    required: false,
    type: 'text',
    points: 8
  },
  {
    id: 'gender',
    question: "What's your gender?",
    field: 'gender',
    phase: 'essential',
    category: 'personal',
    required: false,
    type: 'select',
    options: ['Male', 'Female', 'Other', 'Prefer not to say'],
    points: 5
  },
  
  // Family Information (Phase 2)
  {
    id: 'father_name',
    question: "What's your father's name?",
    field: 'father_name',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'text',
    points: 15
  },
  {
    id: 'mother_name',
    question: "What's your mother's name?",
    field: 'mother_name',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'text',
    points: 15
  },
  {
    id: 'siblings',
    question: "Tell me about your siblings (names and relationships)",
    field: 'siblings',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'textarea',
    points: 12
  },
  {
    id: 'family_origin_stories',
    question: "Share any family origin stories or history you know",
    field: 'family_origin_stories',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'textarea',
    points: 20
  },
  {
    id: 'family_traditions',
    question: "What are some unique family traditions you have?",
    field: 'family_traditions',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'textarea',
    points: 15
  },
  {
    id: 'grandfather_stories',
    question: "Tell me about your grandfathers (paternal and maternal)",
    field: 'grandfather_stories',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'textarea',
    points: 15
  },
  {
    id: 'grandmother_stories',
    question: "Tell me about your grandmothers (paternal and maternal)",
    field: 'grandmother_stories',
    phase: 'family',
    category: 'family',
    required: false,
    type: 'textarea',
    points: 15
  },
  
  // Personal Details (Phase 3)
  {
    id: 'childhood_memories',
    question: "Share some of your favorite childhood memories",
    field: 'childhood_memories',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'textarea',
    points: 12
  },
  {
    id: 'kindergarten_memories',
    question: "Do you remember your kindergarten or early school days?",
    field: 'kindergarten_memories',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'textarea',
    points: 10
  },
  {
    id: 'childhood_friends',
    question: "Tell me about your childhood friends",
    field: 'childhood_friends',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'textarea',
    points: 10
  },
  {
    id: 'hobbies',
    question: "What are your hobbies and interests?",
    field: 'hobbies',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'textarea',
    points: 8
  },
  {
    id: 'languages',
    question: "What languages do you speak?",
    field: 'languages',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'text',
    points: 8
  },
  {
    id: 'religious_background',
    question: "What's your religious or spiritual background?",
    field: 'religious_background',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'text',
    points: 8
  },
  {
    id: 'profession',
    question: "What do you do for work?",
    field: 'profession',
    phase: 'personal',
    category: 'personal',
    required: false,
    type: 'text',
    points: 8
  },
  
  // Education (Phase 4)
  {
    id: 'primary_school',
    question: "Which primary/elementary school did you attend?",
    field: 'primary_school',
    phase: 'education',
    category: 'education',
    required: false,
    type: 'text',
    points: 8
  },
  {
    id: 'high_school',
    question: "Which high school did you attend?",
    field: 'high_school',
    phase: 'education',
    category: 'education',
    required: false,
    type: 'text',
    points: 8
  },
  {
    id: 'university',
    question: "Did you attend university/college? If so, which one?",
    field: 'university',
    phase: 'education',
    category: 'education',
    required: false,
    type: 'text',
    points: 8
  },
  
  // Additional Personal Info (Phase 5)
  {
    id: 'bio',
    question: "Tell me a bit about yourself (a short bio)",
    field: 'bio',
    phase: 'additional',
    category: 'personal',
    required: false,
    type: 'textarea',
    points: 10
  },
  {
    id: 'nickname',
    question: "Do you have any nicknames?",
    field: 'nickname',
    phase: 'additional',
    category: 'personal',
    required: false,
    type: 'text',
    points: 5
  }
];

/**
 * Get the next unanswered question for a user
 * This is the main chatflow endpoint - saves directly to MongoDB
 */
const getNextQuestion = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's current profile data from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get answered questions from user model
    const answeredQuestions = user.ai_questionnaire_completed_questions || [];
    const skippedQuestions = user.ai_questionnaire_skipped_questions || [];

    // Check which questions have already been answered by checking actual user data
    const unansweredQuestions = profileQuestions.filter(q => {
      // Check if question was already marked as answered
      if (answeredQuestions.includes(q.id)) {
        return false;
      }

      // Check if the field already has data in user profile
      if (q.field && hasUserData(user, q.field)) {
        return false; // Skip questions where user already has data
      }

      // Skip if user explicitly skipped this question
      if (skippedQuestions.includes(q.id)) {
        return false;
      }

      return true;
    });

    // Get the next unanswered question
    const nextQuestion = unansweredQuestions[0];

    if (!nextQuestion) {
      // All questions answered - mark questionnaire as completed
      const updates = {
        ai_questionnaire_completed: true,
        updated_at: new Date()
      };

      await User.findByIdAndUpdate(userId, updates);
      
      // Recalculate profile completion using the centralized calculator
      const completionData = await updateUserProfileCompletion(userId);
      const completionPercentage = completionData.percentage;

      return res.json({
        success: true,
        data: {
          completed: true,
          message: "Congratulations! You've completed your profile.",
          completionPercentage,
          totalQuestions: profileQuestions.length,
          answeredCount: profileQuestions.length
        }
      });
    }
    
    // Calculate current completion for progress display
    const totalQuestions = profileQuestions.length;
    const questionsWithData = profileQuestions.filter(q => 
      answeredQuestions.includes(q.id) || (q.field && hasUserData(user, q.field))
    ).length;
    const progressPercentage = Math.round((questionsWithData / totalQuestions) * 100);

    // Return the next question
    res.json({
      success: true,
      data: {
        question: nextQuestion,
        completionPercentage: user.profile_completion_percentage || progressPercentage,
        totalQuestions,
        answeredCount: questionsWithData,
        remainingCount: unansweredQuestions.length,
        phase: nextQuestion.phase,
        category: nextQuestion.category
      }
    });

  } catch (error) {
    console.error('Get next question error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get next question',
      error: error.message
    });
  }
};

/**
 * Save an answer from the chatflow
 * This saves directly to MongoDB User model
 */
const saveAnswer = async (req, res) => {
  try {
    const userId = req.userId;
    const { questionId, answer, skipped = false } = req.body;

    if (!questionId) {
      return res.status(400).json({
        success: false,
        message: 'Question ID is required'
      });
    }

    // Find the question details
    const question = profileQuestions.find(q => q.id === questionId);
    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Invalid question ID'
      });
    }

    // Get current user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build update object
    const updates = {};
    const responses = user.ai_questionnaire_responses || {};
    const answeredQuestions = user.ai_questionnaire_completed_questions || [];
    const skippedQuestions = user.ai_questionnaire_skipped_questions || [];
    let totalPoints = user.ai_questionnaire_points || 0;

    if (skipped) {
      // Add to skipped questions
      if (!skippedQuestions.includes(questionId)) {
        skippedQuestions.push(questionId);
      }
      
      updates.ai_questionnaire_skipped_questions = skippedQuestions;
      
      console.log(`⏭️ User ${userId} skipped question: ${questionId}`);
    } else {
      // Save the answer to responses and update the actual profile field
      responses[questionId] = {
        question: question.question,
        answer: answer,
        field: question.field,
        timestamp: new Date()
      };
      
      // Add to answered questions
      if (!answeredQuestions.includes(questionId)) {
        answeredQuestions.push(questionId);
        totalPoints += question.points || 0;
      }

      updates.ai_questionnaire_responses = responses;
      updates.ai_questionnaire_completed_questions = answeredQuestions;
      updates.ai_questionnaire_points = totalPoints;

      // Update the user profile field directly in the same updates object
      if (question.field && answer) {
        const profileUpdates = getProfileFieldUpdates(question.field, answer);
        Object.assign(updates, profileUpdates);
      }

      console.log(`✅ User ${userId} answered question ${questionId}: ${question.field} = ${answer}`);
    }

    // Single atomic update to ensure data consistency
    updates.updated_at = new Date();
    await User.findByIdAndUpdate(userId, updates, { new: true });
    
    // Recalculate profile completion using the centralized calculator
    const completionData = await updateUserProfileCompletion(userId);
    const completionPercentage = completionData.percentage;
    
    console.log(`💾 Saved questionnaire data for user ${userId}: ${Object.keys(responses).length} responses, ${completionPercentage}% complete`);

    res.json({
      success: true,
      message: skipped ? 'Question skipped' : 'Answer saved successfully',
      data: {
        questionId,
        saved: !skipped,
        completionPercentage,
        totalPoints,
        answeredCount: answeredQuestions.length,
        remainingCount: totalQuestions - questionsWithData
      }
    });

  } catch (error) {
    console.error('Save answer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save answer',
      error: error.message
    });
  }
};

/**
 * Get all unanswered questions
 */
const getUnansweredQuestions = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's current profile data from MongoDB
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const answeredQuestions = user.ai_questionnaire_completed_questions || [];
    const skippedQuestions = user.ai_questionnaire_skipped_questions || [];

    // Filter unanswered questions
    const unansweredQuestions = profileQuestions.filter(q => {
      // Check if already answered
      if (answeredQuestions.includes(q.id)) {
        return false;
      }

      // Check if field has data in MongoDB user profile
      if (q.field && hasUserData(user, q.field)) {
        return false;
      }

      // Skip if explicitly skipped
      if (skippedQuestions.includes(q.id)) {
        return false;
      }

      return true;
    });

    // Group by phase
    const questionsByPhase = {};
    unansweredQuestions.forEach(q => {
      if (!questionsByPhase[q.phase]) {
        questionsByPhase[q.phase] = [];
      }
      questionsByPhase[q.phase].push(q);
    });

    // Calculate completion based on answered + existing data
    const questionsWithData = profileQuestions.filter(q => 
      answeredQuestions.includes(q.id) || (q.field && hasUserData(user, q.field))
    ).length;

    res.json({
      success: true,
      data: {
        unansweredQuestions,
        questionsByPhase,
        totalUnanswered: unansweredQuestions.length,
        totalQuestions: profileQuestions.length,
        answeredCount: answeredQuestions.length,
        questionsWithDataCount: questionsWithData,
        completionPercentage: Math.round((questionsWithData / profileQuestions.length) * 100)
      }
    });

  } catch (error) {
    console.error('Get unanswered questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unanswered questions',
      error: error.message
    });
  }
};

/**
 * Get chatflow status
 */
const getChatflowStatus = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const answeredQuestions = user.ai_questionnaire_completed_questions || [];
    const skippedQuestions = user.ai_questionnaire_skipped_questions || [];
    const totalPoints = user.ai_questionnaire_points || 0;

    // Calculate stats
    const totalQuestions = profileQuestions.length;
    const questionsWithData = profileQuestions.filter(q => 
      answeredQuestions.includes(q.id) || (q.field && hasUserData(user, q.field))
    ).length;
    const completionPercentage = Math.round((questionsWithData / totalQuestions) * 100);

    // Get questions by category
    const categoryCounts = {};
    profileQuestions.forEach(q => {
      if (!categoryCounts[q.category]) {
        categoryCounts[q.category] = { total: 0, answered: 0, withData: 0 };
      }
      categoryCounts[q.category].total++;
      if (answeredQuestions.includes(q.id)) {
        categoryCounts[q.category].answered++;
      }
      if (answeredQuestions.includes(q.id) || (q.field && hasUserData(user, q.field))) {
        categoryCounts[q.category].withData++;
      }
    });

    res.json({
      success: true,
      data: {
        totalQuestions,
        answeredCount: answeredQuestions.length,
        skippedCount: skippedQuestions.length,
        questionsWithDataCount: questionsWithData,
        remainingCount: totalQuestions - questionsWithData,
        completionPercentage,
        totalPoints,
        currentPhase: getCurrentPhase(totalPoints),
        categoryCounts,
        isComplete: questionsWithData === totalQuestions
      }
    });

  } catch (error) {
    console.error('Get chatflow status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chatflow status',
      error: error.message
    });
  }
};

/**
 * Reset chatflow (for testing)
 */
const resetChatflow = async (req, res) => {
  try {
    const userId = req.userId;
    const { clearMainProfile = false } = req.body;

    // Build reset updates
    const updates = {
      ai_questionnaire_responses: {},
      ai_questionnaire_completed_questions: [],
      ai_questionnaire_skipped_questions: [],
      ai_questionnaire_points: 0,
      ai_questionnaire_completed: false,
      profile_completion_percentage: 0,
      updated_at: new Date()
    };

    if (clearMainProfile) {
      // Clear all profile fields
      updates.full_name = null;
      updates.date_of_birth = null;
      updates.place_of_birth = null;
      updates.current_location = null;
      updates.gender = null;
      updates.father_name = null;
      updates.mother_name = null;
      updates.bio = null;
      updates.profession = null;
      updates.interests = [];
      updates.family_info = {};
      updates.personal_info = {};
      updates.education = {};
      updates.profile_completed = false;
      updates.profile_complete = false;
    }

    await User.findByIdAndUpdate(userId, updates);

    console.log(`🔄 Reset questionnaire data for user ${userId}${clearMainProfile ? ' (including profile data)' : ''}`);

    res.json({
      success: true,
      message: 'Chatflow reset successfully',
      data: {
        clearedMainProfile: clearMainProfile
      }
    });

  } catch (error) {
    console.error('Reset chatflow error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset chatflow',
      error: error.message
    });
  }
};

// Helper function to get profile field updates (synchronous version)
const getProfileFieldUpdates = (field, value) => {
  const updates = {};

  // Direct field mappings to MongoDB User model
  const directFields = {
    'full_name': 'full_name',
    'date_of_birth': 'date_of_birth', 
    'place_of_birth': 'place_of_birth',
    'current_address': 'current_location',
    'gender': 'gender',
    'bio': 'bio',
    'nickname': 'nickname',
    'father_name': 'father_name',
    'mother_name': 'mother_name',
    'profession': 'profession',
    'languages': 'primary_language',
    'religious_background': 'cultural_background'
  };

  // Check for direct field mapping
  if (directFields[field]) {
    updates[directFields[field]] = value;
  }

  // Handle nested fields in family_info
  if (['siblings', 'family_origin_stories', 'family_traditions', 'grandfather_stories', 'grandmother_stories'].includes(field)) {
    updates[`family_info.${field}`] = value;
  }

  // Handle nested fields in personal_info  
  if (['childhood_memories', 'kindergarten_memories', 'childhood_friends'].includes(field)) {
    updates[`personal_info.${field}`] = value;
  }

  // Handle interests array for hobbies
  if (field === 'hobbies') {
    // Split by comma and clean up
    const interestsArray = value.split(',').map(item => item.trim()).filter(item => item);
    updates.interests = interestsArray;
  }

  // Handle education fields
  if (['primary_school', 'high_school', 'university'].includes(field)) {
    updates[`education.${field}`] = value;
  }

  if (Object.keys(updates).length === 0) {
    console.log(`⚠️ No field mapping found for: ${field}`);
  }

  return updates;
};

// Helper function to check if user has data for a field
const hasUserData = (user, field) => {
  const directFields = {
    'full_name': 'full_name',
    'date_of_birth': 'date_of_birth', 
    'place_of_birth': 'place_of_birth',
    'current_address': 'current_location',
    'gender': 'gender',
    'bio': 'bio',
    'nickname': 'nickname',
    'father_name': 'father_name',
    'mother_name': 'mother_name',
    'profession': 'profession',
    'languages': 'primary_language',
    'religious_background': 'cultural_background'
  };

  const nestedFields = {
    'siblings': ['family_info', 'siblings'],
    'family_origin_stories': ['family_info', 'origin_stories'], 
    'family_traditions': ['family_info', 'traditions'],
    'grandfather_stories': ['family_info', 'grandfather_stories'],
    'grandmother_stories': ['family_info', 'grandmother_stories'],
    'childhood_memories': ['personal_info', 'childhood_memories'],
    'kindergarten_memories': ['personal_info', 'kindergarten_memories'], 
    'childhood_friends': ['personal_info', 'childhood_friends'],
    'hobbies': ['interests'], // Special case - array
    'primary_school': ['education', 'primary_school'],
    'high_school': ['education', 'high_school'], 
    'university': ['education', 'university']
  };

  // Check direct fields
  if (directFields[field]) {
    const value = user[directFields[field]];
    return value && value.toString().trim() !== '';
  }
  
  // Check nested fields
  if (nestedFields[field]) {
    if (field === 'hobbies') {
      return user.interests && user.interests.length > 0;
    }
    
    const [parent, child] = nestedFields[field];
    if (child) {
      return user[parent] && user[parent][child] && user[parent][child].toString().trim() !== '';
    } else {
      return user[parent] && user[parent].length > 0;
    }
  }

  return false;
};

// Helper function to get user data for a field
const getUserFieldValue = (user, field) => {
  const directFields = {
    'full_name': 'full_name',
    'date_of_birth': 'date_of_birth', 
    'place_of_birth': 'place_of_birth',
    'current_address': 'current_location',
    'gender': 'gender',
    'bio': 'bio',
    'nickname': 'nickname',
    'father_name': 'father_name',
    'mother_name': 'mother_name',
    'profession': 'profession',
    'languages': 'primary_language',
    'religious_background': 'cultural_background'
  };

  const nestedFields = {
    'siblings': ['family_info', 'siblings'],
    'family_origin_stories': ['family_info', 'origin_stories'], 
    'family_traditions': ['family_info', 'traditions'],
    'grandfather_stories': ['family_info', 'grandfather_stories'],
    'grandmother_stories': ['family_info', 'grandmother_stories'],
    'childhood_memories': ['personal_info', 'childhood_memories'],
    'kindergarten_memories': ['personal_info', 'kindergarten_memories'], 
    'childhood_friends': ['personal_info', 'childhood_friends'],
    'hobbies': ['interests'], // Special case - array
    'primary_school': ['education', 'primary_school'],
    'high_school': ['education', 'high_school'], 
    'university': ['education', 'university']
  };

  // Get direct fields
  if (directFields[field]) {
    return user[directFields[field]];
  }
  
  // Get nested fields
  if (nestedFields[field]) {
    if (field === 'hobbies') {
      return user.interests ? user.interests.join(', ') : '';
    }
    
    const [parent, child] = nestedFields[field];
    if (child) {
      return user[parent] && user[parent][child];
    } else {
      return user[parent];
    }
  }

  return null;
};

// Helper function to determine current phase based on points
const getCurrentPhase = (points) => {
  if (points >= 200) return 'complete';
  if (points >= 150) return 'additional';
  if (points >= 100) return 'education';
  if (points >= 60) return 'personal';
  if (points >= 30) return 'family';
  return 'essential';
};

/**
 * Get all questionnaire responses for profile review
 */
const getQuestionnaireResponses = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const responses = user.ai_questionnaire_responses || {};
    const answeredQuestions = user.ai_questionnaire_completed_questions || [];

    // Build detailed response data
    const detailedResponses = {};
    Object.entries(responses).forEach(([questionId, responseData]) => {
      const question = profileQuestions.find(q => q.id === questionId);
      if (question) {
        detailedResponses[questionId] = {
          ...responseData,
          questionText: question.question,
          category: question.category,
          phase: question.phase,
          currentValue: getUserFieldValue(user, question.field)
        };
      }
    });

    // Also include responses that were detected from existing profile data
    profileQuestions.forEach(q => {
      if (!responses[q.id] && q.field && hasUserData(user, q.field)) {
        detailedResponses[q.id] = {
          question: q.question,
          answer: getUserFieldValue(user, q.field),
          field: q.field,
          timestamp: user.updated_at || new Date(),
          questionText: q.question,
          category: q.category,
          phase: q.phase,
          currentValue: getUserFieldValue(user, q.field),
          fromExistingProfile: true
        };
      }
    });

    res.json({
      success: true,
      data: {
        responses: detailedResponses,
        totalResponses: Object.keys(detailedResponses).length,
        answeredQuestions,
        completionPercentage: user.profile_completion_percentage || 0,
        questionsCompleted: answeredQuestions.length,
        totalQuestions: profileQuestions.length
      }
    });

  } catch (error) {
    console.error('Get questionnaire responses error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get questionnaire responses',
      error: error.message
    });
  }
};

/**
 * Sync questionnaire responses to profile (already handled automatically)
 */
const syncResponsesToProfile = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const responses = user.ai_questionnaire_responses || {};
    const answeredQuestions = user.ai_questionnaire_completed_questions || [];

    // Since responses are already saved directly to profile, just return status
    console.log(`ℹ️ Responses are already synced to profile for user ${userId}`);

    res.json({
      success: true,
      message: 'All questionnaire responses are already synced to your profile',
      data: {
        syncedCount: answeredQuestions.length,
        totalResponses: Object.keys(responses).length,
        note: 'Responses are automatically saved to your profile when you answer questions'
      }
    });

  } catch (error) {
    console.error('Sync responses to profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check sync status',
      error: error.message
    });
  }
};

module.exports = {
  getNextQuestion,
  saveAnswer,
  getUnansweredQuestions,
  getChatflowStatus,
  resetChatflow,
  getQuestionnaireResponses,
  syncResponsesToProfile
};