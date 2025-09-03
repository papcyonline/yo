const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../models');
const { validate, sanitizeInput } = require('../../middleware/validation');

const router = express.Router();

// Apply input sanitization to all routes
router.use(sanitizeInput);

// Initialize Twilio
const twilio = require('twilio');
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// SMS sending function
async function sendSMS(phone, message) {
  try {
    console.log(`📱 Sending SMS to ${phone}: ${message}`);
    
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${phone}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Generate JWT token pair (access + refresh)
const generateTokenPair = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set it in your environment variables.');
  }
  
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '15m' } // Short-lived access token
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' } // Long-lived refresh token
  );

  return { accessToken, refreshToken };
};

// Legacy function for backward compatibility
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured. Please set it in your environment variables.');
  }
  
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: User login
 *     description: Authenticate user with email/phone and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             emailLogin:
 *               summary: Login with email
 *               value:
 *                 email: user@example.com
 *                 password: securePassword123
 *             phoneLogin:
 *               summary: Login with phone
 *               value:
 *                 phone: +1234567890
 *                 password: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid credentials
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/login', validate('login'), async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    
    console.log('🔐 Login attempt:', { phone, email });

    // Find user by email or phone
    const query = email ? { email: email.toLowerCase() } : { phone };
    console.log('🔍 Looking for user with query:', query);
    
    const user = await User.findOne(query);

    if (!user) {
      console.log(`❌ User not found with query:`, query);
      // Let's also check how many users have similar emails
      if (email) {
        const similarUsers = await User.find({ 
          email: { $regex: email.split('@')[0], $options: 'i' } 
        }).select('email first_name last_name');
        console.log('📧 Similar email users found:', similarUsers);
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log(`✅ User found: ${user._id} ${user.first_name} ${user.last_name}`);

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token pair
    const { accessToken, refreshToken } = generateTokenPair(user._id);
    
    console.log(`✅ Login successful for user: ${user._id}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: accessToken, // For backward compatibility
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 15 * 60, // 15 minutes in seconds
        token_type: 'Bearer',
        user: {
          id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          profile_photo_url: user.profile_photo_url,
          email_verified: user.email_verified,
          phone_verified: user.phone_verified,
          profile_completion_percentage: user.profile_completion_percentage
        }
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      phone, 
      password, 
      first_name, 
      last_name, 
      username,
      gender,
      location,
      date_of_birth,
      profile_photo_url,
      onboarding_data 
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email?.toLowerCase() },
        { phone },
        { username: username?.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email, phone, or username'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with all profile fields
    const newUser = new User({
      email: email?.toLowerCase(),
      phone,
      password_hash: hashedPassword,
      first_name,
      last_name,
      username: username?.toLowerCase(),
      gender,
      location,
      current_location: location,
      date_of_birth,
      profile_photo_url,
      profile_picture_url: profile_photo_url,
      // Set profile completion based on provided fields
      profile_completion_percentage: 30, // Base registration gives 30%
      profile_completed: false,
      profile_complete: false,
      is_active: true,
      email_verified: false,
      phone_verified: false,
      // Initialize onboarding responses if provided
      onboarding_responses: new Map(),
      onboarding_phase: 'essential'
    });

    // Save any additional onboarding data
    if (onboarding_data) {
      for (const [key, value] of Object.entries(onboarding_data)) {
        newUser.onboarding_responses.set(key, value);
      }
    }

    // Save the user
    await newUser.save();

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ New user registered:', newUser.email || newUser.phone);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          _id: newUser._id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          email: newUser.email,
          phone: newUser.phone,
          username: newUser.username,
          gender: newUser.gender,
          location: newUser.location,
          profile_photo_url: newUser.profile_photo_url
        }
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// Phone Registration route
router.post('/register/phone', async (req, res) => {
  try {
    console.log('📱 Phone registration request body:', req.body);
    
    const { 
      phone, 
      password,
      confirmPassword,
      first_name, 
      firstName,
      last_name, 
      lastName,
      username,
      gender,
      location,
      date_of_birth,
      dateOfBirth,
      profile_photo_url,
      onboarding_data 
    } = req.body;

    // Handle field name variations
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;
    const finalDateOfBirth = date_of_birth || dateOfBirth;

    // Validate required fields
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!finalFirstName) {
      return res.status(400).json({
        success: false,
        message: 'First name is required'
      });
    }

    if (!finalLastName) {
      return res.status(400).json({
        success: false,
        message: 'Last name is required'
      });
    }

    // For phone registration, password might not be required initially
    // Generate a temporary password if not provided
    let finalPassword = password;
    if (!finalPassword) {
      // Generate a temporary password that can be changed later
      finalPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      console.log(`🔐 Generated temporary password for ${phone}: ${finalPassword}`);
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { phone },
        { username: username?.toLowerCase() }
      ]
    });

    if (existingUser) {
      // Check if this is a "Resend OTP" request (minimal data sent)
      const isResendOTP = !username && !gender && !location && !finalDateOfBirth;
      
      if (isResendOTP) {
        // This is actually a "Resend OTP" request, not a registration
        // Generate and return verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`📱 Resend OTP for existing user ${phone}: ${verificationCode}`);
        
        // Send actual SMS
        const smsMessage = `Your Yo! verification code is: ${verificationCode}. Valid for 5 minutes.`;
        const smsResult = await sendSMS(phone, smsMessage);
        
        if (smsResult.success) {
          return res.json({
            success: true,
            message: 'Verification code sent successfully',
            isResendOTP: true
          });
        } else {
          // Fallback: if SMS fails, still return success but log error
          return res.json({
            success: true,
            message: 'Verification code sent successfully',
            code: verificationCode,
            isResendOTP: true,
            sms_error: smsResult.error
          });
        }
      } else {
        // This is a genuine registration attempt with existing user
        return res.status(400).json({
          success: false,
          message: 'User already exists with this phone or username'
        });
      }
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(finalPassword, salt);

    // Create new user with all profile fields
    const newUser = new User({
      phone,
      password_hash: hashedPassword,
      first_name: finalFirstName,
      last_name: finalLastName,
      username: username?.toLowerCase(),
      gender,
      location,
      current_location: location,
      date_of_birth: finalDateOfBirth,
      profile_photo_url,
      profile_picture_url: profile_photo_url,
      // Set profile completion based on provided fields
      profile_completion_percentage: 30, // Base registration gives 30%
      profile_completed: false,
      profile_complete: false,
      is_active: true,
      email_verified: false,
      phone_verified: false,
      // Initialize onboarding responses if provided
      onboarding_responses: new Map(),
      onboarding_phase: 'essential'
    });

    // Save any additional onboarding data
    if (onboarding_data) {
      for (const [key, value] of Object.entries(onboarding_data)) {
        newUser.onboarding_responses.set(key, value);
      }
    }

    // Save the user
    await newUser.save();

    // Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: newUser._id, phone: newUser.phone },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ New user registered via phone:', newUser.phone);

    // Generate and send OTP for phone verification
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`📱 Generated verification code for new user ${newUser.phone}: ${verificationCode}`);
    
    // Send SMS with verification code
    const smsMessage = `Welcome to Yo! Your verification code is: ${verificationCode}. Valid for 5 minutes.`;
    const smsResult = await sendSMS(newUser.phone, smsMessage);
    
    if (smsResult.success) {
      console.log('✅ SMS sent to new registered user');
    } else {
      console.error('❌ Failed to send SMS to new registered user:', smsResult.error);
    }

    res.status(201).json({
      success: true,
      message: 'Phone registration successful. Verification code sent via SMS.',
      data: {
        token,
        user: {
          _id: newUser._id,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          phone: newUser.phone,
          username: newUser.username,
          gender: newUser.gender,
          location: newUser.location,
          date_of_birth: newUser.date_of_birth,
          profile_photo_url: newUser.profile_photo_url,
          temporary_password: !password // Indicate if password was generated
        },
        // Include verification code for development (remove in production)
        verification_code: smsResult.success ? undefined : verificationCode,
        sms_status: smsResult.success ? 'sent' : 'failed'
      }
    });
  } catch (error) {
    console.error('❌ Phone registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during phone registration',
      error: error.message
    });
  }
});

// Send SMS verification code
router.post('/send-verification', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log(`📱 Sending verification code to: ${phone}`);
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Generate verification code regardless of whether user exists
    // This allows for both new registrations and existing user verification
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📱 Generated verification code for ${phone}: ${verificationCode}`);
    
    // Send actual SMS
    const smsMessage = `Your Yo! verification code is: ${verificationCode}. Valid for 5 minutes.`;
    const smsResult = await sendSMS(phone, smsMessage);
    
    if (smsResult.success) {
      res.json({
        success: true,
        message: 'Verification code sent successfully'
        // Don't return the code in production for security
      });
    } else {
      // Fallback: if SMS fails, still return success but log error
      console.error('SMS failed but continuing for development');
      res.json({
        success: true,
        message: 'Verification code sent successfully',
        // For development: return code if SMS fails
        code: verificationCode,
        sms_error: smsResult.error
      });
    }
  } catch (error) {
    console.error('❌ SMS verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send verification code'
    });
  }
});

// Resend verification code - alias endpoint
router.post('/resend-verification', async (req, res) => {
  try {
    const { phone } = req.body;
    
    console.log(`📱 Resending verification code to: ${phone}`);
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📱 Resent verification code for ${phone}: ${verificationCode}`);
    
    // Send actual SMS
    const smsMessage = `Your Yo! verification code is: ${verificationCode}. Valid for 5 minutes.`;
    const smsResult = await sendSMS(phone, smsMessage);
    
    if (smsResult.success) {
      res.json({
        success: true,
        message: 'Verification code resent successfully'
      });
    } else {
      // Fallback: if SMS fails, still return success but log error
      console.error('SMS failed but continuing for development');
      res.json({
        success: true,
        message: 'Verification code resent successfully',
        // For development: return code if SMS fails
        code: verificationCode,
        sms_error: smsResult.error
      });
    }
  } catch (error) {
    console.error('❌ SMS resend error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code'
    });
  }
});

// Verify phone number
router.post('/verify-phone', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    // For now, accept any 6-digit code (implement actual verification later)
    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phone });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update phone verification status
    user.phone_verified = true;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    console.log(`✅ Phone verified successfully for user: ${user._id}`);

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        token,
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          gender: user.gender,
          location: user.location,
          date_of_birth: user.date_of_birth,
          profile_photo_url: user.profile_photo_url,
          phone_verified: user.phone_verified
        }
      }
    });
  } catch (error) {
    console.error('❌ Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Phone verification failed'
    });
  }
});

// Alternative endpoint path for verify/phone
router.post('/verify/phone', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    console.log(`📱 Phone verification attempt for ${phone} with code: ${code}`);
    
    // For now, accept any 6-digit code (implement actual verification later)
    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Find user by phone number
    const user = await User.findOne({ phone });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update phone verification status
    user.phone_verified = true;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    console.log(`✅ Phone verified successfully for user: ${user._id}`);

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        token,
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          gender: user.gender,
          location: user.location,
          date_of_birth: user.date_of_birth,
          profile_photo_url: user.profile_photo_url,
          phone_verified: user.phone_verified
        }
      }
    });
  } catch (error) {
    console.error('❌ Phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Phone verification failed'
    });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

// Add email to existing user
const authMiddleware = require('../../middleware/auth');
const emailService = require('../../services/emailService');
router.post('/add-email', authMiddleware, async (req, res) => {
  try {
    const { email, password, userInfo } = req.body;
    const userId = req.userId; // Get user ID from auth middleware
    
    console.log(`📧 Adding email ${email} to user: ${userId}`);
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Check if email is already in use by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(),
      _id: { $ne: userId }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use by another user'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare update data
    const updateData = { 
      email: email.toLowerCase(),
      password_hash: hashedPassword,
      email_verified: false
    };

    // If userInfo is provided, merge it with update data
    if (userInfo) {
      Object.assign(updateData, {
        first_name: userInfo.firstName,
        last_name: userInfo.lastName,
        username: userInfo.username,
        date_of_birth: userInfo.dateOfBirth,
        gender: userInfo.gender
      });
    }

    // Find and update the user
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log(`✅ Email added successfully for user: ${userId}`);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📝 Storing verification code: ${verificationCode} for user: ${userId}`);
    
    // Store verification code in user document (you may want to add expiry)
    const updatedUser = await User.findByIdAndUpdate(userId, {
      email_verification_code: verificationCode,
      email_verification_expires: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    }, { new: true });
    
    console.log(`✅ Verification code stored. User now has code: ${updatedUser.email_verification_code}`);

    // Send verification email
    const emailResult = await emailService.sendVerificationEmail(
      user.email,
      verificationCode,
      user.first_name || 'User'
    );

    console.log('📧 Email verification result:', emailResult);

    // Include verification code in development mode for easier testing
    const devCode = process.env.NODE_ENV === 'development' ? verificationCode : undefined;

    res.json({
      success: true,
      message: 'Email added successfully. Please check your email for the verification code.',
      data: {
        email: user.email,
        testCode: devCode, // Include code in development mode only
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          gender: user.gender,
          location: user.location,
          date_of_birth: user.date_of_birth,
          profile_photo_url: user.profile_photo_url,
          phone_verified: user.phone_verified,
          email_verified: user.email_verified
        }
      }
    });
  } catch (error) {
    console.error('❌ Add email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding email'
    });
  }
});

// Verify email endpoint
router.post('/verify-email', authMiddleware, async (req, res) => {
  try {
    const { email, code } = req.body;
    const userId = req.userId;

    console.log(`📧 Email verification attempt for ${email} with code: ${code}`);

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required'
      });
    }

    // Find user and check verification code
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email matches
    if (user.email !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match user account'
      });
    }

    // Check verification code
    console.log(`🔍 Verification code comparison:`);
    console.log(`  Stored code: "${user.email_verification_code}" (type: ${typeof user.email_verification_code})`);
    console.log(`  Provided code: "${code}" (type: ${typeof code})`);
    console.log(`  Codes match: ${user.email_verification_code === code}`);
    
    if (user.email_verification_code !== code) {
      console.log(`❌ Code mismatch - stored: "${user.email_verification_code}", provided: "${code}"`);
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code'
      });
    }

    // Check if code is expired
    if (user.email_verification_expires && user.email_verification_expires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired'
      });
    }

    // Update user as email verified
    user.email_verified = true;
    user.email_verification_code = undefined;
    user.email_verification_expires = undefined;
    await user.save();

    console.log(`✅ Email verified successfully for user: ${userId}`);

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.first_name || 'User');

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          phone: user.phone,
          username: user.username,
          email_verified: true
        }
      }
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
});

// Resend email verification code
router.post('/resend-email-code', authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    
    if (!user || user.email !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request'
      });
    }

    // Generate new verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Update user with new code
    user.email_verification_code = verificationCode;
    user.email_verification_expires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    // Send new verification email
    await emailService.sendVerificationEmail(
      user.email,
      verificationCode,
      user.first_name || 'User'
    );

    res.json({
      success: true,
      message: 'New verification code sent',
      data: {
        testCode: process.env.NODE_ENV === 'development' ? verificationCode : undefined
      }
    });

  } catch (error) {
    console.error('❌ Resend email code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification code'
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log(`🔐 Forgot password request for: ${email}`);

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success for security (don't reveal if user exists)
    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent'
      });
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Add password reset fields to user
    user.password_reset_code = resetCode;
    user.password_reset_expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    console.log(`📧 Password reset code generated for ${email}: ${resetCode}`);

    // Send reset email (would use email service in production)
    console.log(`✅ Reset code: ${resetCode}`);

    res.json({
      success: true,
      message: 'If the email exists, a reset code has been sent',
      ...(process.env.NODE_ENV === 'development' && { testCode: resetCode })
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, code, and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    console.log(`🔐 Reset password attempt for: ${email} with code: ${code}`);

    // Find user and verify reset code
    const user = await User.findOne({
      email: email.toLowerCase(),
      password_reset_code: code,
      password_reset_expires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }

    // Hash new password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset fields
    user.password_hash = hashedPassword;
    user.password_reset_code = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    console.log(`✅ Password reset successful for: ${email}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// Refresh token route
router.post('/refresh-token', (req, res) => {
  res.json({
    success: false,
    message: 'Refresh token not implemented'
  });
});

// Logout route
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    if (userId) {
      // Update user's online status
      await User.findByIdAndUpdate(userId, {
        last_seen: new Date(),
        is_online: false
      });
      
      console.log(`👋 User ${userId} logged out`);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh access token
 *     description: Get a new access token using a valid refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     token_type:
 *                       type: string
 *                       example: Bearer
 *                     expires_in:
 *                       type: number
 *                       example: 900
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Invalid refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select('is_active');
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'User not found or deactivated'
      });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    console.log(`🔄 Token refreshed for user: ${decoded.userId}`);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: 15 * 60 // 15 minutes in seconds
      }
    });

  } catch (error) {
    console.error('❌ Token refresh error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Token refresh failed'
    });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     description: Invalidate user session (client should discard tokens)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 */
router.post('/logout', async (req, res) => {
  // For JWT tokens, logout is typically handled client-side by discarding tokens
  // In a more advanced implementation, you would maintain a blacklist of tokens
  
  console.log('🔓 User logout');
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

module.exports = router;