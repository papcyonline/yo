const { User } = require('../models');

/**
 * Calculate comprehensive profile completion percentage
 * This service ensures consistent calculation across the entire system
 */

// Define all profile sections and their weights
// ONBOARDING = 30%, QUESTIONNAIRE = 70%
const profileSections = {
  // Onboarding Information (30% of total)
  onboarding: {
    weight: 30,
    fields: {
      first_name: { required: true, points: 8 },
      last_name: { required: true, points: 8 },
      username: { required: true, points: 8 },
      date_of_birth: { required: true, points: 8 },
      gender: { required: true, points: 8 },
      location: { required: true, points: 8 }
    }
  },
  
  // AI Questionnaire (70% of total)
  questionnaire: {
    weight: 70,
    fields: {
      ai_questionnaire_completed_questions: { required: false, points: 100 }
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
    
    // Special handling for AI questionnaire - give full 70% when questionnaire is completed
    const questionnaireCount = user.ai_questionnaire_completed_questions?.length || 0;
    if (questionnaireCount >= 15) {
      // Consider questionnaire complete if user answered 15+ questions
      sectionScores.questionnaire = 100;
    } else if (questionnaireCount > 0) {
      // Progressive scoring: each answer gives ~6.67% of the questionnaire section
      sectionScores.questionnaire = Math.min(100, (questionnaireCount / 15) * 100);
    }
    
    // Calculate weighted score using the updated section scores
    weightedScore = 0;
    for (const [sectionName, section] of Object.entries(profileSections)) {
      weightedScore += (sectionScores[sectionName] * section.weight) / 100;
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