const { supabase } = require('../../config/database');

// Complete question flow with all profile fields
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
 * This is the main chatflow endpoint
 */
const getNextQuestion = async (req, res) => {
  try {
    const userId = req.userId;

    // Get user's current profile data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Get progressive profile data
    const { data: progressiveProfile, error: progressiveError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Create progressive profile if it doesn't exist
    if (!progressiveProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('progressive_profiles')
        .insert({
          user_id: userId,
          current_phase: 'essential',
          answers: {},
          answered_questions: [],
          skipped_questions: [],
          total_points: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
    }

    const answeredQuestions = progressiveProfile?.answered_questions || [];
    const skippedQuestions = progressiveProfile?.skipped_questions || [];
    const answers = progressiveProfile?.answers || {};

    // Check which questions have already been answered
    const unansweredQuestions = profileQuestions.filter(q => {
      // Check if question was already answered in progressive profile
      if (answeredQuestions.includes(q.id)) {
        return false;
      }

      // Check if the field already has data in the main user profile
      if (q.field && user[q.field]) {
        // Add to answered questions if not already there
        if (!answeredQuestions.includes(q.id)) {
          answeredQuestions.push(q.id);
          answers[q.id] = user[q.field];
        }
        return false;
      }

      // Check if it's in JSONB fields
      if (q.field) {
        const jsonbFields = ['family_info', 'personal_info', 'education'];
        for (const jsonbField of jsonbFields) {
          if (user[jsonbField] && user[jsonbField][q.field]) {
            if (!answeredQuestions.includes(q.id)) {
              answeredQuestions.push(q.id);
              answers[q.id] = user[jsonbField][q.field];
            }
            return false;
          }
        }
      }

      return true;
    });

    // Update progressive profile with auto-detected answered questions
    if (answeredQuestions.length > (progressiveProfile?.answered_questions || []).length) {
      await supabase
        .from('progressive_profiles')
        .update({
          answered_questions: answeredQuestions,
          answers: answers,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
    }

    // Get the next unanswered question
    const nextQuestion = unansweredQuestions[0];

    // Calculate completion percentage
    const totalQuestions = profileQuestions.length;
    const completedQuestions = answeredQuestions.length;
    const completionPercentage = Math.round((completedQuestions / totalQuestions) * 100);

    if (!nextQuestion) {
      // All questions answered
      return res.json({
        success: true,
        data: {
          completed: true,
          message: "Congratulations! You've completed your profile.",
          completionPercentage: 100,
          totalQuestions,
          answeredCount: completedQuestions
        }
      });
    }

    // Return the next question
    res.json({
      success: true,
      data: {
        question: nextQuestion,
        completionPercentage,
        totalQuestions,
        answeredCount: completedQuestions,
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

    // Get or create progressive profile
    let { data: progressiveProfile, error: getError } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!progressiveProfile) {
      const { data: newProfile, error: createError } = await supabase
        .from('progressive_profiles')
        .insert({
          user_id: userId,
          current_phase: 'essential',
          answers: {},
          answered_questions: [],
          skipped_questions: [],
          total_points: 0,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      progressiveProfile = newProfile;
    }

    const answers = progressiveProfile.answers || {};
    const answeredQuestions = progressiveProfile.answered_questions || [];
    const skippedQuestions = progressiveProfile.skipped_questions || [];
    let totalPoints = progressiveProfile.total_points || 0;

    if (skipped) {
      // Add to skipped questions
      if (!skippedQuestions.includes(questionId)) {
        skippedQuestions.push(questionId);
      }
    } else {
      // Save the answer
      answers[questionId] = answer;
      
      // Add to answered questions
      if (!answeredQuestions.includes(questionId)) {
        answeredQuestions.push(questionId);
        totalPoints += question.points || 0;
      }

      // Update the main user profile
      if (question.field) {
        await updateUserProfile(userId, question.field, answer);
      }
    }

    // Update progressive profile
    const { error: updateError } = await supabase
      .from('progressive_profiles')
      .update({
        answers,
        answered_questions: answeredQuestions,
        skipped_questions: skippedQuestions,
        total_points: totalPoints,
        current_phase: getCurrentPhase(totalPoints),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Calculate completion
    const totalQuestions = profileQuestions.length;
    const completionPercentage = Math.round((answeredQuestions.length / totalQuestions) * 100);

    res.json({
      success: true,
      message: skipped ? 'Question skipped' : 'Answer saved successfully',
      data: {
        questionId,
        saved: !skipped,
        completionPercentage,
        totalPoints,
        answeredCount: answeredQuestions.length,
        remainingCount: totalQuestions - answeredQuestions.length
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

    // Get user's current profile data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Get progressive profile data
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const answeredQuestions = progressiveProfile?.answered_questions || [];

    // Filter unanswered questions
    const unansweredQuestions = profileQuestions.filter(q => {
      // Check if already answered
      if (answeredQuestions.includes(q.id)) {
        return false;
      }

      // Check if field has data in user profile
      if (q.field && user[q.field]) {
        return false;
      }

      // Check JSONB fields
      if (q.field) {
        const jsonbFields = ['family_info', 'personal_info', 'education'];
        for (const jsonbField of jsonbFields) {
          if (user[jsonbField] && user[jsonbField][q.field]) {
            return false;
          }
        }
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

    res.json({
      success: true,
      data: {
        unansweredQuestions,
        questionsByPhase,
        totalUnanswered: unansweredQuestions.length,
        totalQuestions: profileQuestions.length,
        answeredCount: answeredQuestions.length,
        completionPercentage: Math.round((answeredQuestions.length / profileQuestions.length) * 100)
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

    // Get progressive profile
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const answeredQuestions = progressiveProfile?.answered_questions || [];
    const skippedQuestions = progressiveProfile?.skipped_questions || [];
    const totalPoints = progressiveProfile?.total_points || 0;

    // Calculate stats
    const totalQuestions = profileQuestions.length;
    const completionPercentage = Math.round((answeredQuestions.length / totalQuestions) * 100);

    // Get questions by category
    const categoryCounts = {};
    profileQuestions.forEach(q => {
      if (!categoryCounts[q.category]) {
        categoryCounts[q.category] = { total: 0, answered: 0 };
      }
      categoryCounts[q.category].total++;
      if (answeredQuestions.includes(q.id)) {
        categoryCounts[q.category].answered++;
      }
    });

    res.json({
      success: true,
      data: {
        totalQuestions,
        answeredCount: answeredQuestions.length,
        skippedCount: skippedQuestions.length,
        remainingCount: totalQuestions - answeredQuestions.length,
        completionPercentage,
        totalPoints,
        currentPhase: progressiveProfile?.current_phase || 'essential',
        categoryCounts,
        isComplete: answeredQuestions.length === totalQuestions
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

    // Reset progressive profile
    const { error: resetError } = await supabase
      .from('progressive_profiles')
      .update({
        answers: {},
        answered_questions: [],
        skipped_questions: [],
        total_points: 0,
        current_phase: 'essential',
        completion_percentage: 0,
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (resetError) throw resetError;

    // Optionally clear main profile fields
    if (clearMainProfile) {
      const clearFields = {};
      profileQuestions.forEach(q => {
        if (q.field) {
          clearFields[q.field] = null;
        }
      });

      await supabase
        .from('users')
        .update({
          ...clearFields,
          family_info: {},
          personal_info: {},
          education: {},
          profile_completed: false,
          profile_completion_percentage: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }

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

// Helper function to update user profile
const updateUserProfile = async (userId, field, value) => {
  try {
    const updates = { updated_at: new Date().toISOString() };

    // Direct field mappings
    const directFields = [
      'full_name', 'date_of_birth', 'place_of_birth', 'current_address',
      'gender', 'bio', 'nickname', 'father_name', 'mother_name', 'siblings',
      'family_origin_stories', 'family_traditions', 'grandfather_stories',
      'grandmother_stories', 'childhood_memories', 'kindergarten_memories',
      'childhood_friends', 'hobbies', 'languages', 'religious_background',
      'profession', 'primary_school', 'high_school', 'university'
    ];

    // JSONB field mappings
    const jsonbMappings = {
      'family_info': [
        'father_name', 'mother_name', 'siblings', 'family_origin_stories',
        'family_traditions', 'grandfather_stories', 'grandmother_stories'
      ],
      'personal_info': [
        'childhood_memories', 'kindergarten_memories', 'childhood_friends',
        'hobbies', 'languages', 'religious_background', 'profession'
      ],
      'education': [
        'primary_school', 'high_school', 'university'
      ]
    };

    // Check if it's a direct field
    if (directFields.includes(field)) {
      // Some fields might also be stored in JSONB
      let isJsonbField = false;
      let jsonbTable = null;

      // Check if field should be in JSONB
      for (const [table, fields] of Object.entries(jsonbMappings)) {
        if (fields.includes(field)) {
          isJsonbField = true;
          jsonbTable = table;
          break;
        }
      }

      if (isJsonbField && jsonbTable) {
        // Update JSONB field
        const { data: currentUser } = await supabase
          .from('users')
          .select(jsonbTable)
          .eq('id', userId)
          .single();

        const currentData = currentUser?.[jsonbTable] || {};
        updates[jsonbTable] = { ...currentData, [field]: value };
      } else {
        // Update direct field
        updates[field] = value;
      }
    }

    // Update the user profile
    await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

  } catch (error) {
    console.error('Update user profile error:', error);
    // Don't throw - this is supplementary
  }
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

module.exports = {
  getNextQuestion,
  saveAnswer,
  getUnansweredQuestions,
  getChatflowStatus,
  resetChatflow
};