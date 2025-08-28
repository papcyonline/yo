const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Authentication fields
  email: { 
    type: String, 
    unique: true, 
    sparse: true, // Allow null values but maintain uniqueness
    lowercase: true 
  },
  phone: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  password_hash: String,
  
  // Basic profile information
  first_name: { type: String, required: true },
  last_name: { type: String, required: true },
  username: { 
    type: String, 
    unique: true, 
    sparse: true, 
    lowercase: true 
  },
  full_name: String, // Virtual or computed field
  
  // Personal details
  date_of_birth: Date,
  gender: { 
    type: String, 
    enum: ['male', 'female', 'Male', 'Female', 'other', 'Other', 'prefer_not_to_say', 'Prefer not to say'],
    default: null 
  },
  bio: { type: String, maxlength: 500 },
  nickname: String,
  location: String,
  city: String,
  state: String,
  country: String,
  
  // Profile media
  profile_picture_url: String,
  profile_photo_url: String,
  cover_photo_url: String,
  
  // Verification status
  email_verified: { type: Boolean, default: false },
  phone_verified: { type: Boolean, default: false },
  
  // Verification codes
  email_verification_code: String,
  email_verification_expires: Date,
  phone_verification_code: String,
  phone_verification_expires: Date,
  
  // Password reset
  password_reset_code: String,
  password_reset_expires: Date,
  
  // Account status
  is_active: { type: Boolean, default: true },
  profile_completed: { type: Boolean, default: false },
  profile_complete: { type: Boolean, default: false },
  profile_completion_percentage: { type: Number, default: 0 },
  
  // Settings & Preferences
  preferred_language: { type: String, default: 'en' },
  timezone: { type: String, default: 'UTC' },
  display_name: String,
  display_name_preference: { 
    type: String, 
    enum: ['username', 'full_name', 'first_name'], 
    default: 'username' 
  },
  
  // Social & Family Information
  family_info: {
    father_name: String,
    mother_name: String,
    siblings: [String],
    origin_stories: [String]
  },
  
  personal_info: {
    childhood_memories: [String],
    childhood_friends: [String],
    languages: [String],
    kindergarten_memories: [String],
    profession: String,
    hobbies: [String],
    religious_background: String,
    personal_bio: String
  },
  
  // Top-level fields for easy access
  profession: String,
  religious_background: String,
  
  education: {
    primary_school: String,
    high_school: String,
    university: String
  },
  
  // Arrays for additional data
  interests: [String],
  
  // Notification preferences
  notification_preferences: {
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true },
    email: { type: Boolean, default: true }
  },
  
  // Privacy settings
  privacy_settings: {
    show_location: { type: Boolean, default: false },
    profile_visible: { type: Boolean, default: true }
  },
  
  // OAuth
  google_id: String,
  facebook_id: String,
  
  // Tokens and sessions
  refresh_token: String,
  token_expires_at: Date,
  last_login_at: Date,
  push_token: String,  // Expo push notification token
  push_token_platform: { type: String, enum: ['ios', 'android'] },
  
  // Security
  login_attempts: { type: Number, default: 0 },
  locked_until: Date,
  is_online: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['offline', 'online', 'typing', 'recording', 'away'],
    default: 'offline'
  },
  last_seen: Date,
  
  // Terms & Privacy Acceptance
  terms_accepted: { type: Boolean, default: false },
  terms_accepted_at: Date,
  terms_version: String, // Track which version was accepted
  privacy_policy_accepted: { type: Boolean, default: false },
  privacy_policy_accepted_at: Date,
  privacy_policy_version: String,
  
  // UNIFIED ONBOARDING RESPONSES
  // Replaces both registration fields + AI questionnaire responses
  onboarding_responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  onboarding_phase: {
    type: String,
    enum: ['essential', 'core', 'rich', 'completed'],
    default: 'essential'
  },
  onboarding_completed: { type: Boolean, default: false },
  
  // FAMILY MATCHING DATA (extracted from onboarding)
  father_name: String,
  mother_name: String,
  family_origin: String, // Where family is originally from
  primary_language: String,
  family_languages: [String], // All languages/dialects spoken
  siblings_names: String, // Text field with sibling names
  
  // SOCIAL MATCHING DATA (extracted from onboarding)
  current_location: String,
  previous_locations: [String], // Places previously lived
  schools_attended: [String], // Schools for friend matching
  cultural_background: String,
  
  // LEGACY SUPPORT (keep for backward compatibility)
  ai_questionnaire_responses: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ai_questionnaire_completed: { type: Boolean, default: false },
  questionnaire_completion_date: Date,
  
  // AI Matching Results
  ai_matches: [{
    userId: mongoose.Schema.Types.ObjectId,
    score: Number,
    confidence: mongoose.Schema.Types.Mixed, // Can be string enum or number
    type: { type: String, enum: ['family', 'friend', 'community'] },
    factors: mongoose.Schema.Types.Mixed,
    reasoning: String,
    matchDetails: [String],
    created_at: { type: Date, default: Date.now }
  }],
  matches_last_updated: Date,
  match_statistics: {
    total_matches: { type: Number, default: 0 },
    family_matches: { type: Number, default: 0 },
    friend_matches: { type: Number, default: 0 },
    community_matches: { type: Number, default: 0 },
    high_confidence_matches: { type: Number, default: 0 }
  },
  
  // Friends and Social Connections
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  friend_count: { type: Number, default: 0 },
  
  // Gamification
  total_points: { type: Number, default: 0 },
  achievement_level: { 
    type: String, 
    enum: ['beginner', 'intermediate', 'advanced', 'expert'], 
    default: 'beginner' 
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual fields
userSchema.virtual('fullName').get(function() {
  return `${this.first_name || ''} ${this.last_name || ''}`.trim() || 'User';
});

userSchema.virtual('firstName').get(function() {
  return this.first_name;
});

userSchema.virtual('lastName').get(function() {
  return this.last_name;
});

userSchema.virtual('profilePictureUrl').get(function() {
  return this.profile_picture_url || this.profile_photo_url;
});

userSchema.virtual('profilePhotoUrl').get(function() {
  return this.profile_photo_url || this.profile_picture_url;
});

userSchema.virtual('avatarUrl').get(function() {
  return this.profile_picture_url || this.profile_photo_url;
});

userSchema.virtual('emailVerified').get(function() {
  return this.email_verified;
});

userSchema.virtual('phoneVerified').get(function() {
  return this.phone_verified;
});

userSchema.virtual('isActive').get(function() {
  return this.is_active;
});

userSchema.virtual('dateOfBirth').get(function() {
  return this.date_of_birth;
});

userSchema.virtual('profileCompleted').get(function() {
  return this.profile_completed;
});

userSchema.virtual('createdAt').get(function() {
  return this.created_at;
});

userSchema.virtual('updatedAt').get(function() {
  return this.updated_at;
});

// Indexes for better performance (unique indexes handled by schema definitions above)
userSchema.index({ created_at: 1 });
userSchema.index({ is_active: 1 });

// Search indexes for user search functionality
userSchema.index({ first_name: 1, last_name: 1 }); // Name search
userSchema.index({ first_name: 'text', last_name: 'text', profession: 'text', location: 'text' }); // Full text search
userSchema.index({ profession: 1 }); // Profession filter
userSchema.index({ location: 1, city: 1, country: 1 }); // Location search
userSchema.index({ interests: 1 }); // Interests filter
userSchema.index({ date_of_birth: 1 }); // Age filter
userSchema.index({ profilePictureUrl: 1 }); // Has photo filter
userSchema.index({ last_activity: -1 }); // Activity/online status
userSchema.index({ suspended: 1, isActive: 1 }); // Account status

// Compound indexes for common search combinations
userSchema.index({ is_active: 1, suspended: 1, last_activity: -1 }); // Active users by activity
userSchema.index({ profession: 1, location: 1 }); // Profession + location filter
userSchema.index({ interests: 1, location: 1 }); // Interests + location filter

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Update full_name if first_name or last_name changed
  if (this.isModified('first_name') || this.isModified('last_name')) {
    this.full_name = `${this.first_name || ''} ${this.last_name || ''}`.trim();
  }
  
  // Calculate profile completion percentage
  this.profile_completion_percentage = this.calculateCompletionPercentage();
  this.profile_complete = this.profile_completion_percentage >= 80;
  
  next();
});

// Methods
userSchema.methods.calculateCompletionPercentage = function() {
  // Get responses from BOTH unified onboarding AND legacy AI questionnaire systems
  const onboardingResponses = this.onboarding_responses || {};
  const aiQuestionnaireResponses = this.ai_questionnaire_responses || {};
  
  // Combine answered questions from both systems
  const unifiedAnswered = Object.keys(onboardingResponses).filter(key => {
    const value = onboardingResponses[key];
    return value && String(value).trim() !== '';
  });
  
  const aiAnswered = Object.keys(aiQuestionnaireResponses).filter(key => {
    const value = aiQuestionnaireResponses[key];
    return value && String(value).trim() !== '';
  });
  
  // Merge and deduplicate answered questions
  const allAnsweredQuestions = [...new Set([...unifiedAnswered, ...aiAnswered])];
  
  // Count basic profile fields (from registration)
  const basicFields = ['first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender', 'location'];
  const basicFieldsCompleted = basicFields.filter(field => {
    const value = this[field];
    return value && String(value).trim() !== '';
  }).length;
  
  // Define core questions (AI questionnaire)
  const coreAIQuestions = [
    'family_stories', 'childhood_nickname', 'childhood_friends', 'childhood_memories',
    'father_name', 'mother_name', 'siblings_relatives', 'kindergarten_memories',
    'primary_school', 'secondary_school', 'university_college', 'languages_dialects',
    'personal_bio', 'profession', 'hobbies', 'religious_background', 'family_traditions',
    'educational_background'
  ];
  
  const coreQuestionsAnswered = coreAIQuestions.filter(q => allAnsweredQuestions.includes(q)).length;
  
  // Calculate completion percentage
  // Basic profile: 30%, Core AI questions: 70%
  const basicPercentage = (basicFieldsCompleted / basicFields.length) * 30;
  const corePercentage = (coreQuestionsAnswered / coreAIQuestions.length) * 70;
  const totalPercentage = Math.round(basicPercentage + corePercentage);
  
  console.log(`📊 Profile completion: Basic(${basicFieldsCompleted}/${basicFields.length})=${Math.round(basicPercentage)}%, AI(${coreQuestionsAnswered}/${coreAIQuestions.length})=${Math.round(corePercentage)}% = ${totalPercentage}% | Total answered: ${allAnsweredQuestions.length}`);
  
  return Math.min(totalPercentage, 100);
};

userSchema.methods.toSafeJSON = function() {
  const userObject = this.toObject();
  delete userObject.password_hash;
  delete userObject.refresh_token;
  
  // Ensure response objects are properly displayed
  userObject.ai_questionnaire_responses = this.ai_questionnaire_responses || {};
  userObject.onboarding_responses = this.onboarding_responses || {};
  
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;