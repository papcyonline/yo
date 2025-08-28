const { supabase } = require('../../config/database');

// ============================================
// ONBOARDING PROGRESS MANAGEMENT
// ============================================

// Get user's onboarding progress
const getOnboardingProgress = async (req, res) => {
  try {
    const userId = req.userId;

    const { data: progress, error } = await supabase
      .from('user_onboarding_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    res.json({
      success: true,
      data: progress || {
        currentStep: 1,
        completedSteps: [],
        isCompleted: false,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get onboarding progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding progress'
    });
  }
};

// Update user's onboarding progress
const updateOnboardingProgress = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentStep, completedSteps, isCompleted, lastUpdated } = req.body;

    // Validate input
    if (!currentStep || !Array.isArray(completedSteps)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid progress data'
      });
    }

    // Check if progress record exists
    const { data: existingProgress } = await supabase
      .from('user_onboarding_progress')
      .select('id')
      .eq('user_id', userId)
      .single();

    let progressData;

    if (existingProgress) {
      // Update existing record
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .update({
          current_step: currentStep,
          completed_steps: completedSteps,
          is_completed: isCompleted || false,
          last_updated: lastUpdated || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      progressData = data;
    } else {
      // Create new record
      const { data, error } = await supabase
        .from('user_onboarding_progress')
        .insert([{
          user_id: userId,
          current_step: currentStep,
          completed_steps: completedSteps,
          is_completed: isCompleted || false,
          last_updated: lastUpdated || new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      progressData = data;
    }

    res.json({
      success: true,
      message: 'Onboarding progress updated successfully',
      data: {
        currentStep: progressData.current_step,
        completedSteps: progressData.completed_steps,
        isCompleted: progressData.is_completed,
        lastUpdated: progressData.last_updated
      }
    });

  } catch (error) {
    console.error('Update onboarding progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update onboarding progress'
    });
  }
};

// Reset user's onboarding progress
const resetOnboardingProgress = async (req, res) => {
  try {
    const userId = req.userId;

    const { error } = await supabase
      .from('user_onboarding_progress')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Onboarding progress reset successfully'
    });

  } catch (error) {
    console.error('Reset onboarding progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset onboarding progress'
    });
  }
};

// Get onboarding statistics (admin endpoint)
const getOnboardingStats = async (req, res) => {
  try {
    // Get total users with onboarding progress
    const { data: progressStats, error: progressError } = await supabase
      .from('user_onboarding_progress')
      .select('is_completed, completed_steps, current_step');

    if (progressError) throw progressError;

    // Calculate statistics
    const totalUsers = progressStats.length;
    const completedUsers = progressStats.filter(p => p.is_completed).length;
    const completionRate = totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;

    // Step completion statistics
    const stepStats = {};
    progressStats.forEach(progress => {
      progress.completed_steps.forEach(step => {
        stepStats[step] = (stepStats[step] || 0) + 1;
      });
    });

    // Average completion percentage
    const avgStepsCompleted = totalUsers > 0 
      ? progressStats.reduce((sum, p) => sum + p.completed_steps.length, 0) / totalUsers
      : 0;

    // Current step distribution
    const currentStepDistribution = {};
    progressStats.forEach(progress => {
      const step = progress.current_step;
      currentStepDistribution[step] = (currentStepDistribution[step] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        completedUsers,
        completionRate: Math.round(completionRate * 100) / 100,
        avgStepsCompleted: Math.round(avgStepsCompleted * 100) / 100,
        stepCompletionStats: stepStats,
        currentStepDistribution
      }
    });

  } catch (error) {
    console.error('Get onboarding stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding statistics'
    });
  }
};

module.exports = {
  getOnboardingProgress,
  updateOnboardingProgress,
  resetOnboardingProgress,
  getOnboardingStats
};