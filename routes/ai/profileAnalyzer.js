const { User } = require('../../models');
const { analyzeProfileWithAI, generateMatchingRecommendations } = require('../../services/ai/profileCompletionService');

// AI Profile Completion Analyzer - MongoDB version
const analyzeProfileCompletion = async (req, res) => {
  try {
    // Get user data from MongoDB
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get questionnaire data from user model (no more separate progressive profile)
    const questionnaireData = {
      answers: user.ai_questionnaire_responses || {},
      answered_questions: user.ai_questionnaire_completed_questions || [],
      total_points: user.ai_questionnaire_points || 0,
      completion_percentage: user.profile_completion_percentage || 0,
      completed: user.ai_questionnaire_completed || false
    };

    // Analyze profile completeness with enhanced AI
    const aiAnalysis = await analyzeProfileWithAI(user, questionnaireData);
    
    // Get matching recommendations
    const matchingRecommendations = await generateMatchingRecommendations(user);
    
    // Combine with traditional analysis for backup
    const traditionalAnalysis = await performAIProfileAnalysis(user, questionnaireData);
    
    const combinedAnalysis = {
      ...aiAnalysis,
      traditionalAnalysis,
      matchingRecommendations,
      timestamp: new Date().toISOString(),
      userId: user._id
    };

    res.json({
      success: true,
      data: combinedAnalysis
    });

  } catch (error) {
    console.error('AI Profile analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze profile completion'
    });
  }
};

// AI-powered profile analysis
const performAIProfileAnalysis = async (user, questionnaireData) => {
  // Basic completion scoring
  const scores = {
    core: calculateCoreCompletion(user),
    family: calculateFamilyCompletion(user),
    personal: calculatePersonalCompletion(user),
    education: calculateEducationCompletion(user),
    interests: calculateInterestsCompletion(user),
    aiQuestionnaire: calculateAIQuestionnaireCompletion(questionnaireData)
  };

  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;

  // AI recommendations based on missing data
  const recommendations = generateAIRecommendations(user, scores);

  // Matching potential analysis
  const matchingPotential = calculateMatchingPotential(user, scores);

  // Priority suggestions for better matching
  const prioritySuggestions = generatePrioritySuggestions(user, scores);

  return {
    completionScore: Math.round(totalScore),
    isComplete: totalScore >= 85,
    scores,
    recommendations,
    matchingPotential,
    prioritySuggestions,
    progressiveAnswers: questionnaireData?.answers ? Object.keys(questionnaireData.answers).length : 0,
    estimatedImprovementTime: calculateEstimatedTime(scores),
    missingCriticalFields: findMissingCriticalFields(user, scores)
  };
};

// Core completion (registration data)
const calculateCoreCompletion = (user) => {
  const coreFields = ['first_name', 'last_name', 'date_of_birth', 'username'];
  const completed = coreFields.filter(field => user[field] && user[field].toString().trim() !== '');
  return (completed.length / coreFields.length) * 100;
};

// MongoDB-based completion calculations
const calculateFamilyCompletion = (user) => {
  let score = 0;
  let maxScore = 5; // Total possible fields
  
  if (user.father_name) score++;
  if (user.mother_name) score++;
  if (user.family_info && user.family_info.siblings) score++;
  if (user.family_info && user.family_info.origin_stories) score++;
  if (user.cultural_background) score++;
  
  return Math.round((score / maxScore) * 100);
};

const calculatePersonalCompletion = (user) => {
  let score = 0;
  let maxScore = 5; // Total possible fields
  
  if (user.bio && user.bio.length > 20) score++;
  if (user.profile_picture_url || user.profile_photo_url) score++;
  if (user.location || user.current_location) score++;
  if (user.profession) score++;
  if (user.personal_info && Object.keys(user.personal_info).length > 0) score++;
  
  return Math.round((score / maxScore) * 100);
};

const calculateEducationCompletion = (user) => {
  if (!user.education) return 0;
  
  let score = 0;
  let maxScore = 3; // primary_school, high_school, university
  
  if (user.education.primary_school) score++;
  if (user.education.high_school) score++;
  if (user.education.university) score++;
  
  return Math.round((score / maxScore) * 100);
};

const calculateInterestsCompletion = (user) => {
  if (!user.interests || !Array.isArray(user.interests)) return 0;
  
  // Consider complete if user has at least 3 interests
  if (user.interests.length >= 3) return 100;
  if (user.interests.length >= 2) return 70;
  if (user.interests.length >= 1) return 40;
  
  return 0;
};

const calculateAIQuestionnaireCompletion = (questionnaireData) => {
  if (!questionnaireData || !questionnaireData.answers) {
    return 0;
  }
  
  const answers = questionnaireData.answers;
  const totalAnswers = Object.keys(answers).length;
  
  // Consider AI questionnaire complete if user has answered at least 10 questions
  // This represents a meaningful interaction with the AI assistant
  if (totalAnswers >= 10) {
    return 100;
  } else if (totalAnswers >= 5) {
    return 70;
  } else if (totalAnswers >= 2) {
    return 40;
  } else if (totalAnswers >= 1) {
    return 20;
  }
  
  return 0;
};

// Generate AI recommendations
const generateAIRecommendations = (user, scores) => {
  const recommendations = [];

  if (scores.core < 100) {
    recommendations.push({
      priority: 'high',
      category: 'core',
      title: 'Complete Basic Information',
      description: 'Your core profile information is incomplete. This is essential for finding matches.',
      estimatedTime: '2 minutes'
    });
  }

  if (scores.family < 60) {
    recommendations.push({
      priority: 'high',
      category: 'family',
      title: 'Add Family Background',
      description: 'Family information is crucial for finding relatives and family connections.',
      estimatedTime: '5 minutes'
    });
  }

  if (scores.personal < 50) {
    recommendations.push({
      priority: 'medium',
      category: 'personal',
      title: 'Share Personal Stories',
      description: 'Personal details help us understand your background better.',
      estimatedTime: '3 minutes'
    });
  }

  if (scores.education < 40) {
    recommendations.push({
      priority: 'medium',
      category: 'education',
      title: 'Add Education History',
      description: 'Education background helps connect you with schoolmates and peers.',
      estimatedTime: '2 minutes'
    });
  }

  if (scores.interests < 30) {
    recommendations.push({
      priority: 'low',
      category: 'interests',
      title: 'Share Your Interests',
      description: 'Interests help us find people with similar hobbies and passions.',
      estimatedTime: '1 minute'
    });
  }

  if (scores.aiQuestionnaire < 70) {
    recommendations.push({
      priority: 'high',
      category: 'aiQuestionnaire',
      title: 'Complete AI Assistant Questions',
      description: 'Answer more questions with our AI assistant for better matching and personalized recommendations.',
      estimatedTime: '5-10 minutes'
    });
  }

  return recommendations;
};

// Calculate matching potential
const calculateMatchingPotential = (user, scores) => {
  const weights = {
    core: 0.25,
    family: 0.3,
    personal: 0.15,
    education: 0.1,
    interests: 0.05,
    aiQuestionnaire: 0.15  // AI questionnaire is important for matching quality
  };

  const weightedScore = Object.entries(scores).reduce((sum, [category, score]) => {
    return sum + (score * weights[category]);
  }, 0);

  let potential = 'low';
  if (weightedScore >= 80) potential = 'excellent';
  else if (weightedScore >= 60) potential = 'good';
  else if (weightedScore >= 40) potential = 'fair';

  return {
    level: potential,
    score: Math.round(weightedScore),
    familyMatchingPotential: scores.family >= 60 ? 'high' : scores.family >= 30 ? 'medium' : 'low',
    educationMatchingPotential: scores.education >= 50 ? 'high' : scores.education >= 25 ? 'medium' : 'low'
  };
};

// Generate priority suggestions
const generatePrioritySuggestions = (user, scores) => {
  const suggestions = [];

  // Critical missing elements for family matching
  if (!user.father_name && !(user.family_info?.father_name)) {
    suggestions.push({
      field: 'father_name',
      importance: 'critical',
      reason: 'Essential for paternal family tree matching',
      quickAdd: true
    });
  }

  if (!user.mother_name && !(user.family_info?.mother_name)) {
    suggestions.push({
      field: 'mother_name',
      importance: 'critical',
      reason: 'Essential for maternal family tree matching',
      quickAdd: true
    });
  }

  if (!user.location && !user.current_address) {
    suggestions.push({
      field: 'location',
      importance: 'high',
      reason: 'Location helps find nearby family and local connections',
      quickAdd: true
    });
  }

  if (!user.date_of_birth) {
    suggestions.push({
      field: 'date_of_birth',
      importance: 'critical',
      reason: 'Birth date is essential for age-appropriate matching',
      quickAdd: true
    });
  }

  return suggestions;
};

// Calculate estimated improvement time
const calculateEstimatedTime = (scores) => {
  const incompleteSections = Object.values(scores).filter(score => score < 80).length;
  return `${incompleteSections * 3}-${incompleteSections * 5} minutes`;
};

// Find missing critical fields
const findMissingCriticalFields = (user, scores) => {
  const critical = [];
  
  if (scores.core < 100) critical.push('basic_information');
  if (scores.family < 30) critical.push('family_background');
  if (!user.bio || user.bio.length < 20) critical.push('personal_bio');
  if (!user.profile_picture_url) critical.push('profile_photo');
  
  return critical;
};

module.exports = {
  analyzeProfileCompletion,
  performAIProfileAnalysis
};