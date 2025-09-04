const { User } = require('../models');

/**
 * Calculate comprehensive profile completion percentage
 * This service ensures consistent calculation across the entire system
 */

// Define all profile sections and their weights
const profileSections = {
  // Core Information (25% of total)
  core: {
    weight: 25,
    fields: {
      first_name: { required: true, points: 5 },
      last_name: { required: true, points: 5 },
      username: { required: true, points: 3 },
      email: { required: true, points: 3 },
      phone: { required: false, points: 2 },
      date_of_birth: { required: true, points: 4 },
      gender: { required: false, points: 3 }
    }
  },
  
  // Profile Details (15% of total)
  profile: {
    weight: 15,
    fields: {
      bio: { required: false, points: 5 },
      profile_photo_url: { required: false, points: 5 },
      location: { required: false, points: 3 },
      nickname: { required: false, points: 2 }
    }
  },
  
  // Family Information (25% of total)
  family: {
    weight: 25,
    fields: {
      father_name: { required: false, points: 8 },
      mother_name: { required: false, points: 8 },
      siblings_names: { required: false, points: 5 },
      family_origin: { required: false, points: 4 }
    }
  },
  
  // Education & Professional (15% of total)
  education: {
    weight: 15,
    fields: {
      profession: { required: false, points: 5 },
      'education.primary_school': { required: false, points: 3 },
      'education.high_school': { required: false, points: 4 },
      'education.university': { required: false, points: 3 }
    }
  },
  
  // Cultural & Personal (10% of total)
  cultural: {
    weight: 10,
    fields: {
      primary_language: { required: false, points: 3 },
      cultural_background: { required: false, points: 3 },
      religious_background: { required: false, points: 2 },
      interests: { required: false, points: 2 }
    }
  },
  
  // AI Questionnaire (10% of total)
  questionnaire: {
    weight: 10,
    fields: {
      ai_questionnaire_completed_questions: { required: false, points: 10 }
    }
  }
};

/**
 * Get nested field value from user object
 */
const getFieldValue = (user, fieldPath) => {
  const parts = fieldPath.split('.');
  let value = user;
  
  for (const part of parts) {
    if (!value || typeof value !== 'object') return null;
    value = value[part];
  }
  
  return value;
};

/**
 * Check if a field has valid data
 */
const hasValidData = (value, fieldName) => {
  if (value === null || value === undefined) return false;
  
  // Special handling for arrays
  if (fieldName === 'interests' || fieldName === 'ai_questionnaire_completed_questions') {
    return Array.isArray(value) && value.length > 0;
  }
  
  // Special handling for nested objects
  if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return Object.keys(value).length > 0;
  }
  
  // String fields
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  
  // Date fields
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  
  return true;
};

/**
 * Calculate completion percentage for a section
 */
const calculateSectionCompletion = (user, section) => {
  const fields = section.fields;
  let totalPoints = 0;
  let earnedPoints = 0;
  
  for (const [fieldPath, config] of Object.entries(fields)) {
    totalPoints += config.points;
    
    const value = getFieldValue(user, fieldPath);
    if (hasValidData(value, fieldPath)) {
      earnedPoints += config.points;
    }
  }
  
  return totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
};

/**
 * Calculate overall profile completion
 */
const calculateProfileCompletion = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    let totalWeight = 0;
    let weightedScore = 0;
    const sectionScores = {};
    const missingFields = [];
    const completedFields = [];
    
    // Calculate each section
    for (const [sectionName, section] of Object.entries(profileSections)) {
      const sectionCompletion = calculateSectionCompletion(user, section);
      sectionScores[sectionName] = Math.round(sectionCompletion);
      
      totalWeight += section.weight;
      weightedScore += (sectionCompletion * section.weight) / 100;
      
      // Track missing and completed fields
      for (const [fieldPath, config] of Object.entries(section.fields)) {
        const value = getFieldValue(user, fieldPath);
        if (hasValidData(value, fieldPath)) {
          completedFields.push(fieldPath);
        } else if (config.required) {
          missingFields.push(fieldPath);
        }
      }
    }
    
    // Special handling for AI questionnaire
    const questionnaireCount = user.ai_questionnaire_completed_questions?.length || 0;
    if (questionnaireCount > 0) {
      // Boost questionnaire score based on number of answers
      const questionnaireBonus = Math.min(questionnaireCount * 2, 20); // Up to 20% bonus
      weightedScore += questionnaireBonus;
      sectionScores.questionnaire = Math.min(100, sectionScores.questionnaire + questionnaireBonus);
    }
    
    const overallPercentage = Math.round(Math.min(100, (weightedScore / totalWeight) * 100));
    
    // Determine if profile is complete (85% threshold)
    const isComplete = overallPercentage >= 85;
    
    // Get critical missing fields (required ones first)
    const criticalMissing = missingFields.slice(0, 3);
    if (criticalMissing.length < 3) {
      // Add non-required but important fields
      const importantFields = ['father_name', 'mother_name', 'bio', 'profile_photo_url'];
      for (const field of importantFields) {
        if (!completedFields.includes(field) && criticalMissing.length < 3) {
          criticalMissing.push(field);
        }
      }
    }
    
    return {
      percentage: overallPercentage,
      isComplete,
      sectionScores,
      completedFields,
      missingFields: criticalMissing,
      totalFields: completedFields.length + missingFields.length,
      questionnaireAnswers: questionnaireCount,
      needsUpdate: user.profile_completion_percentage !== overallPercentage
    };
    
  } catch (error) {
    console.error('Error calculating profile completion:', error);
    throw error;
  }
};

/**
 * Update user's profile completion in database
 */
const updateUserProfileCompletion = async (userId) => {
  try {
    const completion = await calculateProfileCompletion(userId);
    
    // Update user document with new completion data
    const updates = {
      profile_completion_percentage: completion.percentage,
      profile_completed: completion.isComplete,
      profile_complete: completion.isComplete,
      updated_at: new Date()
    };
    
    // Enable blue check verification when profile is 100% complete
    if (completion.percentage >= 100) {
      updates.can_apply_for_verification = true;
      updates.verification_status = 'eligible';
    }
    
    await User.findByIdAndUpdate(userId, updates);
    
    console.log(`Updated profile completion for user ${userId}: ${completion.percentage}%`);
    
    return completion;
  } catch (error) {
    console.error('Error updating profile completion:', error);
    throw error;
  }
};

/**
 * Recalculate completion for all users (maintenance task)
 */
const recalculateAllUserCompletions = async () => {
  try {
    const users = await User.find({}).select('_id');
    let updated = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        await updateUserProfileCompletion(user._id);
        updated++;
      } catch (error) {
        console.error(`Failed to update user ${user._id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`Profile completion recalculation complete. Updated: ${updated}, Errors: ${errors}`);
    return { updated, errors };
    
  } catch (error) {
    console.error('Error in batch recalculation:', error);
    throw error;
  }
};

module.exports = {
  calculateProfileCompletion,
  updateUserProfileCompletion,
  recalculateAllUserCompletions
};