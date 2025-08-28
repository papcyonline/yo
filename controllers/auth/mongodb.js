const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, PhoneVerification, EmailVerification } = require('../../models');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Generate refresh token
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

// Register with phone using MongoDB
const registerPhone = async (req, res) => {
  try {
    const { phone, firstName, lastName, username, fullName, location, gender, dateOfBirth } = req.body;

    if (!phone || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Phone, first name, and last name are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ phone });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Create verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📱 Sending OTP to ${phone} via Twilio`);

    // Clean up any existing verifications for this phone
    await PhoneVerification.deleteMany({ phone });

    // Store pending verification
    const verification = new PhoneVerification({
      phone,
      code: verificationCode,
      first_name: firstName,
      last_name: lastName,
      expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    });

    await verification.save();

    // Send SMS verification code using Twilio
    const smsService = require('../../services/smsService');
    const smsResult = await smsService.sendVerificationCode(phone, verificationCode, firstName);
    
    if (smsResult.success) {
      console.log(`✅ SMS sent to ${phone} via ${smsResult.method || 'Twilio'}`);
    }

    res.json({
      success: true,
      message: 'Verification code sent to your phone',
      data: { 
        phone,
        ...(process.env.NODE_ENV === 'development' && { testCode: verificationCode })
      }
    });

  } catch (error) {
    console.error('Phone registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
};

// Verify phone OTP using MongoDB
const verifyPhone = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        message: 'Phone and verification code are required'
      });
    }

    console.log(`🔍 Verifying phone: ${phone}, code: ${code}`);
    
    // Get verification record
    const verification = await PhoneVerification.findOne({
      phone,
      code,
      expires_at: { $gt: new Date() },
      used: false
    });

    console.log('📋 Verification record found:', !!verification);

    if (!verification) {
      console.error('❌ Verification failed: Invalid or expired code');
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Create user account
    const refreshToken = generateRefreshToken('temp-id'); // Will be updated after user creation
    
    const user = new User({
      phone: verification.phone,
      first_name: verification.first_name,
      last_name: verification.last_name,
      is_active: true,
      phone_verified: true,
      refresh_token: refreshToken
    });

    await user.save();

    // Update refresh token with actual user ID
    const actualRefreshToken = generateRefreshToken(user._id);
    user.refresh_token = actualRefreshToken;
    await user.save();

    // Mark verification as used
    verification.used = true;
    await verification.save();

    // Generate token
    const token = generateToken(user._id);

    // Trigger AI matching for new user
    try {
      const { enhancedMatchingService } = require('../../services/aiMatchingService');
      
      // Auto-trigger enhanced AI matching in the background
      enhancedMatchingService.findMatches(user._id, {
        matchTypes: ['all'],
        maxResults: 50,
        minConfidence: 0.3
      }).catch(error => {
        console.error('Background AI matching error:', error);
      });
      
      console.log(`🧠 AI matching scheduled for new user: ${user._id}`);
    } catch (error) {
      console.error('Failed to schedule basic matching:', error);
    }

    console.log('✅ Phone verification successful');

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: user.fullName,
          phone: user.phone,
          profile_completed: user.profile_completed,
          emailVerified: user.email_verified,
          phoneVerified: user.phone_verified
        },
        token,
        refreshToken: actualRefreshToken
      }
    });

  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
};

// Add email to existing user
const addEmail = async (req, res) => {
  try {
    const { email, password, userInfo } = req.body;
    const userId = req.userId;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Clean up any existing email verifications for this user/email
    await EmailVerification.deleteMany({ 
      $or: [
        { email: email.toLowerCase() },
        { user_id: userId }
      ]
    });

    // Store pending verification
    const verification = new EmailVerification({
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      code: verificationCode,
      user_id: userId,
      expires_at: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });

    await verification.save();

    // Update user with additional info if provided
    if (userInfo) {
      const updates = {};
      if (userInfo.fullName) {
        const nameParts = userInfo.fullName.split(' ');
        updates.first_name = nameParts[0] || updates.first_name;
        updates.last_name = nameParts.slice(1).join(' ') || updates.last_name;
      }
      if (userInfo.username) updates.username = userInfo.username.toLowerCase();
      if (userInfo.location) updates.location = userInfo.location;
      if (userInfo.gender) updates.gender = userInfo.gender;
      if (userInfo.dateOfBirth) updates.date_of_birth = new Date(userInfo.dateOfBirth);
      
      if (Object.keys(updates).length > 0) {
        await User.findByIdAndUpdate(userId, { $set: updates });
      }
    }

    // Send verification email
    const emailService = require('../../services/emailService');
    const user = await User.findById(userId);
    
    await emailService.sendVerificationEmail(email, verificationCode, user.first_name);
    
    res.json({
      success: true,
      message: 'Verification code sent to your email',
      data: { 
        email: email.toLowerCase(),
        ...(process.env.NODE_ENV === 'development' && { testCode: verificationCode })
      }
    });

  } catch (error) {
    console.error('Add email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add email'
    });
  }
};

// Verify email for existing user
const verifyEmailForUser = async (req, res) => {
  try {
    const { email, code } = req.body;
    const userId = req.userId;

    // Get verification record
    const verification = await EmailVerification.findOne({
      email: email.toLowerCase(),
      code,
      user_id: userId,
      expires_at: { $gt: new Date() },
      used: false
    });

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Update user with email and password
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          email: verification.email,
          password_hash: verification.password_hash,
          email_verified: true
        }
      },
      { new: true, select: '-password_hash -refresh_token' }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Mark verification as used
    verification.used = true;
    await verification.save();

    res.json({
      success: true,
      message: 'Email verified and added successfully',
      data: {
        user: user.toSafeJSON()
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    console.log('🔐 Login attempt:', { phone: req.body.phone, email: req.body.email });
    const { phone, email, password } = req.body;

    if (!phone && !email) {
      console.log('❌ Login failed: No phone or email provided');
      return res.status(400).json({
        success: false,
        message: 'Phone or email is required'
      });
    }

    // Find user
    let query = {};
    if (phone) {
      query.phone = phone;
    } else {
      query.email = email.toLowerCase();
    }

    console.log('🔍 Looking for user with query:', query);
    const user = await User.findOne(query);

    if (!user) {
      console.log('❌ Login failed: User not found with query:', query);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('✅ User found:', user._id, user.first_name, user.last_name);

    // If logging in with email, verify password
    if (email && password) {
      if (!user.password_hash) {
        console.log('❌ Login failed: No password set for email login');
        return res.status(401).json({
          success: false,
          message: 'Password not set for this account'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        console.log('❌ Login failed: Invalid password');
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
    }

    if (!user.is_active) {
      console.log('❌ Login failed: Account deactivated');
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate new tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Update refresh token and last login
    user.refresh_token = refreshToken;
    user.last_login_at = new Date();
    await user.save();

    console.log('✅ Login successful for user:', user._id);

    // Check for high matches and send notifications
    const NotificationService = require('../../services/notificationService');
    NotificationService.checkAndSendHighMatchNotifications(user._id).catch(err => {
      console.error('Error checking high match notifications:', err);
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeJSON(),
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const userId = req.userId;

    // Clear refresh token from database
    await User.findByIdAndUpdate(userId, { $unset: { refresh_token: 1 } });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
};

module.exports = {
  registerPhone,
  verifyPhone,
  addEmail,
  verifyEmailForUser,
  login,
  logout,
  generateToken,
  generateRefreshToken
};