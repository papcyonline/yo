const { supabase } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

// Helper function to sync progressive profile data to main profile
const syncProgressiveDataToProfile = async (userId) => {
  try {
    // Get progressive profile data
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('answers, total_points, completion_percentage')
      .eq('user_id', userId)
      .single();

    if (!progressiveProfile || !progressiveProfile.answers) {
      return; // No progressive data to sync
    }

    const answers = progressiveProfile.answers;
    const updates = { updated_at: new Date().toISOString() };
    
    // Map progressive answers to existing user profile fields only
    const fieldMapping = {
      'date_of_birth': 'date_of_birth',
      'gender': 'gender',
      'location': 'location',
      'personal_bio': 'bio',
      'bio': 'bio', // Add direct bio mapping
      'profile_picture_url': 'profile_picture_url',
      'username': 'username' // Add username mapping
    };

    // Process direct field mappings for existing fields only
    for (const [questionId, value] of Object.entries(answers)) {
      if (fieldMapping[questionId] && value) {
        updates[fieldMapping[questionId]] = value;
      }
    }

    // Handle name fields
    if (answers.full_name) {
      const nameParts = answers.full_name.split(' ');
      updates.first_name = nameParts[0] || '';
      updates.last_name = nameParts.slice(1).join(' ') || '';
    }

    // Only update if we have fields to update
    if (Object.keys(updates).length > 1) { // More than just updated_at
      console.log('Syncing progressive data:', updates);
      await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);
    }
  } catch (error) {
    console.log('Progressive sync error (non-critical):', error);
    // Don't throw - this is a background sync
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    // First, sync progressive profile data if available
    await syncProgressiveDataToProfile(req.userId);
    
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, username, email, phone, date_of_birth,
        gender, profile_picture_url, profile_photo_url, bio, location, city, state, country,
        preferred_language, timezone, email_verified, phone_verified, 
        is_active, created_at, updated_at, display_name, profile_completion_percentage,
        profile_complete
      `)
      .eq('id', req.userId)
      .single();

    if (error) throw error;
    
    // Get progressive profile data to fill in missing info
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('*')
      .eq('user_id', req.userId)
      .single();
    
    // Merge data from progressive profile if main profile is missing info
    const mergedUser = { ...user };
    
    console.log('🔍 Original user avatar fields:', {
      profile_picture_url: user.profile_picture_url,
      profile_photo_url: user.profile_photo_url
    });
    
    if (progressiveProfile && progressiveProfile.answers) {
      const answers = progressiveProfile.answers;
      console.log('🔍 Progressive profile answers found:', Object.keys(answers));
      
      // Override with progressive data if main profile lacks it
      if (!mergedUser.bio && answers.personal_bio) {
        mergedUser.bio = answers.personal_bio;
        console.log('📝 Using bio from progressive profile:', answers.personal_bio);
      }
      
      if (!mergedUser.profile_picture_url && answers.profile_image) {
        mergedUser.profile_picture_url = answers.profile_image;
        console.log('📷 Using profile picture from progressive profile');
      }
      
      if (!mergedUser.display_name && answers.childhood_nickname) {
        mergedUser.display_name = answers.childhood_nickname;
        console.log('👤 Using display name from progressive profile:', answers.childhood_nickname);
      }
      
      if (!mergedUser.date_of_birth && answers.date_of_birth) {
        mergedUser.date_of_birth = answers.date_of_birth;
      }
      
      if (!mergedUser.gender && answers.gender) {
        mergedUser.gender = answers.gender;
      }
      
      if (!mergedUser.location && (answers.location || answers.current_location)) {
        mergedUser.location = answers.location || answers.current_location;
      }
      
      // Use progressive completion percentage if higher
      if (progressiveProfile.completion_percentage > (mergedUser.profile_completion_percentage || 0)) {
        mergedUser.profile_completion_percentage = progressiveProfile.completion_percentage;
        mergedUser.profile_complete = progressiveProfile.completion_percentage >= 100;
      }
      
      // Add rich profile data
      mergedUser.familyInfo = {};
      mergedUser.personalInfo = {};
      mergedUser.education = {};
      
      // Debug: Check if profession exists in answers - UPDATED 2025-08-18 10:40
      console.log('🔍 Debug - profession in answers:', 'profession' in answers, answers.profession);
      
      // Family info
      if (answers.father_name) mergedUser.familyInfo.father_name = answers.father_name;
      if (answers.mother_name) mergedUser.familyInfo.mother_name = answers.mother_name;
      if (answers.siblings_relatives) mergedUser.familyInfo.siblings = answers.siblings_relatives;
      if (answers.family_stories) mergedUser.familyInfo.origin_stories = answers.family_stories;
      
      // Personal info
      if (answers.childhood_memories) mergedUser.personalInfo.childhood_memories = answers.childhood_memories;
      if (answers.childhood_friends) mergedUser.personalInfo.childhood_friends = answers.childhood_friends;
      if (answers.languages_dialects) mergedUser.personalInfo.languages = answers.languages_dialects;
      if (answers.kindergarten_memories) mergedUser.personalInfo.kindergarten_memories = answers.kindergarten_memories;
      if (answers.profession) {
        mergedUser.personalInfo.profession = answers.profession;
        console.log('💼 Adding profession from progressive profile:', answers.profession);
      }
      if (answers.hobbies) mergedUser.personalInfo.hobbies = answers.hobbies;
      if (answers.religious_background) mergedUser.personalInfo.religious_background = answers.religious_background;
      
      // Education
      if (answers.primary_school) mergedUser.education.primary_school = answers.primary_school;
      if (answers.secondary_school) mergedUser.education.high_school = answers.secondary_school;
      if (answers.university_college) mergedUser.education.university = answers.university_college;
    }
    
    // Debug log the actual user data
    console.log('🔍 MERGED USER DATA:', {
      id: mergedUser.id,
      username: mergedUser.username,
      email: mergedUser.email,
      first_name: mergedUser.first_name,
      last_name: mergedUser.last_name,
      display_name: mergedUser.display_name,
      profile_picture_url: mergedUser.profile_picture_url,
      bio: mergedUser.bio,
      completion: mergedUser.profile_completion_percentage
    });

    // Calculate profile completion with merged data
    const completionData = calculateProfileCompletion(mergedUser);

    // Choose the best available avatar URL - prioritize HTTP URLs over file:// URLs
    const getBestAvatarUrl = () => {
      // Check profile_photo_url first (from uploads)
      if (mergedUser.profile_photo_url && mergedUser.profile_photo_url.startsWith('http')) {
        return mergedUser.profile_photo_url;
      }
      // Fall back to profile_picture_url if it's HTTP
      if (mergedUser.profile_picture_url && mergedUser.profile_picture_url.startsWith('http')) {
        return mergedUser.profile_picture_url;
      }
      // Last resort: use whatever is available (could be file:// URL)
      return mergedUser.profile_photo_url || mergedUser.profile_picture_url;
    };

    const bestAvatarUrl = getBestAvatarUrl();
    console.log('🖼️ Avatar URL selection:', {
      profile_picture_url: mergedUser.profile_picture_url,
      profile_photo_url: mergedUser.profile_photo_url,
      selected: bestAvatarUrl
    });

    res.json({
      success: true,
      data: { 
        user: {
          ...mergedUser,
          firstName: mergedUser.first_name,
          lastName: mergedUser.last_name,
          fullName: `${mergedUser.first_name || ''} ${mergedUser.last_name || ''}`.trim() || mergedUser.display_name || 'User',
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
          dateOfBirth: user.date_of_birth,
          profileCompleted: user.profile_completed || user.profile_complete,
          profilePhotoUrl: bestAvatarUrl,
          profilePictureUrl: bestAvatarUrl,
          avatarUrl: bestAvatarUrl,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          completionPercentage: completionData.percentage,
          missingFields: completionData.missing
        }
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
    delete updates.created_at;
    delete updates.email_verified;
    delete updates.phone_verified;
    delete updates.is_active;

    // Filter to only include existing fields to avoid schema errors
    const existingFields = [
      'email', 'phone', 'username', 'first_name', 'last_name', 
      'date_of_birth', 'gender', 'bio', 'profile_picture_url',
      'location', 'city', 'state', 'country', 'preferred_language',
      'timezone'
    ];
    
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (existingFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      } else {
        console.log(`⏭️ Skipping field not in current schema: ${key}`);
      }
    });

    // Handle special field mappings
    if (updates.full_name) {
      const nameParts = updates.full_name.split(' ');
      filteredUpdates.first_name = nameParts[0] || '';
      filteredUpdates.last_name = nameParts.slice(1).join(' ') || '';
      console.log('📝 Mapped full_name to first_name/last_name');
    }
    
    if (updates.current_address) {
      filteredUpdates.location = updates.current_address;
      console.log('📍 Mapped current_address to location');
    }

    // Add updated timestamp
    filteredUpdates.updated_at = new Date().toISOString();

    console.log('✅ Final filtered updates:', JSON.stringify(filteredUpdates, null, 2));

    // Check if user exists first
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', req.userId)
      .single();

    if (!existingUser) {
      console.log('❌ User not found with ID:', req.userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('👤 User exists, proceeding with update...');

    // Use a more basic update approach
    const { data: updateResult, error: updateError } = await supabase
      .from('users')
      .update(filteredUpdates)
      .eq('id', req.userId)
      .select();

    if (updateError) {
      console.log('💥 Supabase update error:', JSON.stringify(updateError, null, 2));
      
      // Handle specific constraint errors
      if (updateError.code === '23505') {
        // Unique constraint violation
        if (updateError.message.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists'
          });
        }
        if (updateError.message.includes('username')) {
          return res.status(400).json({
            success: false,
            message: 'Username already exists'
          });
        }
        if (updateError.message.includes('phone')) {
          return res.status(400).json({
            success: false,
            message: 'Phone number already exists'
          });
        }
      }
      
      throw updateError;
    }

    // Then fetch the updated user
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (fetchError) {
      console.log('💥 Supabase fetch error:', JSON.stringify(fetchError, null, 2));
      throw fetchError;
    }

    console.log('✅ Profile updated successfully!');

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { 
        user: {
          ...user,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User',
          dateOfBirth: user.date_of_birth,
          profilePhotoUrl: user.profile_picture_url,
          profilePictureUrl: user.profile_picture_url,
          avatarUrl: user.profile_picture_url, // Add for frontend compatibility
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified,
          isActive: user.is_active,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
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

    // Check if username is already taken (if provided)
    if (username) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username.toLowerCase())
        .neq('id', req.userId)
        .single();

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    const updates = {
      ...(firstName && { first_name: firstName }),
      ...(lastName && { last_name: lastName }),
      ...(username && { username: username.toLowerCase() }),
      ...(dateOfBirth && { date_of_birth: dateOfBirth }),
      ...(gender && { gender }),
      ...(bio !== undefined && { bio }),
      ...(location && { location }),
      updated_at: new Date().toISOString()
    };

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Basic information updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update basic info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update basic information'
    });
  }
};

// Update family information
const updateFamilyInfo = async (req, res) => {
  try {
    const familyInfo = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        family_info: familyInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Family information updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update family info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update family information'
    });
  }
};

// Update personal information
const updatePersonalInfo = async (req, res) => {
  try {
    const personalInfo = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        personal_info: personalInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Personal information updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update personal info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update personal information'
    });
  }
};

// Update education information
const updateEducationInfo = async (req, res) => {
  try {
    const educationInfo = req.body;

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        education: educationInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Education information updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update education info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update education information'
    });
  }
};

// Update interests
const updateInterests = async (req, res) => {
  try {
    const { interests } = req.body;

    if (!Array.isArray(interests)) {
      return res.status(400).json({
        success: false,
        message: 'Interests must be an array'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        interests,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Interests updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update interests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update interests'
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

    // Create full URL for local storage (can be replaced with cloud storage)
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 9000}`;
    const photoUrl = `${baseUrl}/uploads/images/${req.file.filename}`;

    // Update user profile with new photo URL
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        profile_picture_url: photoUrl, // Use consistent field name
        profile_photo_url: photoUrl,   // Keep both for compatibility
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    // Also update progressive profile if exists
    try {
      // Get current progressive profile answers
      const { data: progressiveProfile } = await supabase
        .from('progressive_profiles')
        .select('answers')
        .eq('user_id', req.userId)
        .single();
      
      if (progressiveProfile) {
        const updatedAnswers = {
          ...progressiveProfile.answers,
          profile_picture_url: photoUrl
        };
        
        await supabase
          .from('progressive_profiles')
          .update({
            answers: updatedAnswers,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', req.userId);
      }
    } catch (progressiveError) {
      console.log('Progressive profile update failed (non-critical):', progressiveError);
    }

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: { 
        photoUrl,
        user: {
          ...user,
          profilePictureUrl: photoUrl,
          profilePhotoUrl: photoUrl
        }
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

// Delete profile photo
const deletePhoto = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        profile_photo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profile photo deleted successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo'
    });
  }
};

// Get other user's profile (privacy filtered)
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, profile_photo_url, 
        bio, location, gender, interests,
        created_at
      `)
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate age if date_of_birth exists (but don't expose the actual date)
    const { data: privateData } = await supabase
      .from('users')
      .select('date_of_birth')
      .eq('id', userId)
      .single();

    let age = null;
    if (privateData?.date_of_birth) {
      const today = new Date();
      const birthDate = new Date(privateData.date_of_birth);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    res.json({
      success: true,
      data: { 
        user: {
          ...user,
          age
        }
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile'
    });
  }
};

// Get profile completion status
const getCompletionStatus = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();

    if (error) throw error;

    const completionData = calculateProfileCompletion(user);

    res.json({
      success: true,
      data: completionData
    });

  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get completion status'
    });
  }
};

// Mark profile as complete
const markProfileComplete = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        profile_completed: true,
        profile_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profile marked as complete',
      data: { user }
    });

  } catch (error) {
    console.error('Mark profile complete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark profile as complete'
    });
  }
};

// Helper function to calculate profile completion
const calculateProfileCompletion = (user) => {
  // Core required fields from registration
  const coreFields = [
    'first_name', 'last_name', 'date_of_birth', 'username'
  ];

  // Basic profile fields that exist in the actual schema
  const basicFields = [
    'gender', 'bio', 'location', 'profile_picture_url', 'phone', 'email'
  ];

  // Check core fields (must be completed)
  const completedCore = coreFields.filter(field => user[field] && user[field].toString().trim() !== '');
  const completedBasic = basicFields.filter(field => user[field] && user[field].toString().trim() !== '');
  
  // Calculate completion percentages based on existing fields only
  const corePercentage = (completedCore.length / coreFields.length) * 60; // 60% weight for core
  const basicPercentage = (completedBasic.length / basicFields.length) * 40; // 40% weight for basic

  const totalPercentage = Math.round(corePercentage + basicPercentage);

  // Determine missing fields
  const missing = [];
  if (completedCore.length < coreFields.length) {
    missing.push(...coreFields.filter(field => !completedCore.includes(field)));
  }
  if (completedBasic.length < basicFields.length) {
    missing.push(...basicFields.filter(field => !completedBasic.includes(field)));
  }

  // Profile is considered complete if >= 85%
  const isComplete = totalPercentage >= 85;

  return {
    percentage: totalPercentage,
    isComplete,
    requiredCompleted: completedCore.length,
    requiredTotal: coreFields.length,
    basicCompleted: completedBasic.length,
    basicTotal: basicFields.length,
    missing,
    canComplete: completedCore.length === coreFields.length
  };
};

// Update family stories
const updateFamilyStories = async (req, res) => {
  try {
    const { stories } = req.body;

    if (!Array.isArray(stories)) {
      return res.status(400).json({
        success: false,
        message: 'Stories must be an array'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        family_stories: stories,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Family stories updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update family stories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update family stories'
    });
  }
};

// Update display name preference
const updateDisplayNamePreference = async (req, res) => {
  try {
    const { preference } = req.body;

    // Validate preference
    const validPreferences = ['username', 'full_name', 'first_name'];
    if (!validPreferences.includes(preference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid display name preference. Must be one of: username, full_name, first_name'
      });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ 
        display_name_preference: preference,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Display name preference updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update display name preference error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update display name preference'
    });
  }
};

// Get user's display name based on their preference
const getDisplayName = async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error } = await supabase
      .from('users')
      .select('username, first_name, last_name, display_name_preference')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const displayName = getUserDisplayName(user);

    res.json({
      success: true,
      data: { 
        displayName,
        preference: user.display_name_preference || 'username'
      }
    });

  } catch (error) {
    console.error('Get display name error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get display name'
    });
  }
};

// Helper function to determine display name
const getUserDisplayName = (user) => {
  const preference = user.display_name_preference || 'username';
  
  switch (preference) {
    case 'username':
      return user.username || user.first_name || 'User';
    case 'full_name':
      return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'User';
    case 'first_name':
      return user.first_name || user.username || 'User';
    default:
      return user.username || user.first_name || 'User';
  }
};

// Quick fix for missing user data
const fixUserData = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get current user data
    const { data: currentUser } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    // Fix missing fields
    const updates = {};
    
    // If username is missing, use first_name as username
    if (!currentUser.username && currentUser.first_name) {
      updates.username = currentUser.first_name.toLowerCase();
    }
    
    // Get progressive profile data for bio
    const { data: progressiveProfile } = await supabase
      .from('progressive_profiles')
      .select('answers')
      .eq('user_id', userId)
      .single();
    
    if (progressiveProfile?.answers?.bio) {
      updates.bio = progressiveProfile.answers.bio;
    }
    
    // Update if we have fixes
    if (Object.keys(updates).length > 0) {
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      res.json({
        success: true,
        message: 'User data fixed',
        fixed: Object.keys(updates),
        user: updatedUser
      });
    } else {
      res.json({
        success: true,
        message: 'No fixes needed',
        user: currentUser
      });
    }
  } catch (error) {
    console.error('Fix user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix user data'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateBasicInfo,
  updateFamilyInfo,
  updatePersonalInfo,
  updateEducationInfo,
  updateInterests,
  updateFamilyStories,
  uploadPhoto,
  deletePhoto,
  getUserProfile,
  getCompletionStatus,
  markProfileComplete,
  updateDisplayNamePreference,
  getDisplayName,
  getUserDisplayName,
  calculateProfileCompletion,
  fixUserData
};