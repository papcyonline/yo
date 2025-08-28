const { supabase } = require('../../config/database');
const { analyzeProfileWithAI, generateMatchingRecommendations } = require('../../services/ai/profileCompletionService');

// AI Profile Completion Analyzer
const analyzeProfileCompletion = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, username, email, phone, date_of_birth,
        gender, profile_picture_url, bio, location, city, state, country,
        preferred_language, timezone, total_points, achievement_level,
        profile_complete, onboarding_completed, is_active,
        created_at, updated_at
      `)
      .eq('id', req.userId)
      .single();

    if (error) throw error;

    // Get progressive profile data
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();

    // Analyze profile completeness with enhanced AI
    const aiAnalysis = await analyzeProfileWithAI(user, progressiveProfile);
    
    // Get matching recommendations
    const matchingRecommendations = await generateMatchingRecommendations(user);
    
    // Combine with traditional analysis for backup
    const traditionalAnalysis = await performAIProfileAnalysis(user, progressiveProfile);
    
    const combinedAnalysis = {
      ...aiAnalysis,
      traditionalAnalysis,
      matchingRecommendations,
      timestamp: new Date().toISOString(),
      userId: user.id
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
const performAIProfileAnalysis = async (user, progressiveProfile) => {
  // Basic completion scoring
  const scores = {
    core: calculateCoreCompletion(user),
    family: calculateFamilyCompletion(user),
    personal: calculatePersonalCompletion(user),
    education: calculateEducationCompletion(user),
    interests: calculateInterestsCompletion(user)
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
    isComplete: totalScore >= 80,
    scores,
    recommendations,
    matchingPotential,
    prioritySuggestions,
    progressiveAnswers: progressiveProfile?.answers ? Object.keys(progressiveProfile.answers).length : 0,
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

// Simplified completion calculations using only existing fields
const calculateFamilyCompletion = (user) => {
  // Since family fields don't exist in the database yet, return 0 for now
  return 0;
};

const calculatePersonalCompletion = (user) => {
  let score = 0;
  
  if (user.bio && user.bio.length > 20) score += 40;
  if (user.profile_picture_url) score += 30;
  if (user.location) score += 30;
  
  return Math.min(score, 100);
};

const calculateEducationCompletion = (user) => {
  // Since education fields don't exist in the database yet, return 0 for now
  return 0;
};

const calculateInterestsCompletion = (user) => {
  // Since interests fields don't exist in the database yet, return 0 for now
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

  return recommendations;
};

// Calculate matching potential
const calculateMatchingPotential = (user, scores) => {
  const weights = {
    core: 0.3,
    family: 0.35,
    personal: 0.2,
    education: 0.1,
    interests: 0.05
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