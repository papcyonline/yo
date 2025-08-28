const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

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

// Register with phone using Twilio SMS
const registerPhone = async (req, res) => {
  try {
    const { phone, firstName, lastName } = req.body;

    if (!phone || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Phone, first name, and last name are required'
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      });
    }

    // Create verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log(`📱 Sending OTP to ${phone} via Twilio`);

    // Store pending verification
    const { data, error } = await supabase
      .from('phone_verifications')
      .insert([{
        phone,
        code: verificationCode,
        first_name: firstName,
        last_name: lastName,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

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

// Verify phone OTP using custom verification
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
    const { data: verification, error: verifyError } = await supabase
      .from('phone_verifications')
      .select('*')
      .eq('phone', phone)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    console.log('📋 Verification record found:', !!verification);

    if (verifyError || !verification) {
      console.error('❌ Verification failed:', verifyError);
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Create user account
    const userId = uuidv4();
    const refreshToken = generateRefreshToken(userId);
    
    // For now, always use regular client since service role key is not set
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        id: userId,
        phone: verification.phone,
        first_name: verification.first_name,
        last_name: verification.last_name,
        is_active: true,
        phone_verified: true
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ User creation failed:', userError);
      throw userError;
    }

    // Clean up verification record
    await supabase
      .from('phone_verifications')
      .delete()
      .eq('phone', phone);

    // Generate token
    const token = generateToken(user.id);

    console.log('✅ Phone verification successful');

    res.json({
      success: true,
      message: 'Phone verified successfully',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          phone: user.phone,
          profile_completed: user.profile_completed || false,
          emailVerified: user.email_verified || false,
          phoneVerified: user.phone_verified || false
        },
        token,
        refreshToken
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
    const { email, password } = req.body;
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
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .neq('id', userId)
      .single();

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
    
    // Store pending verification
    const { data, error } = await supabase
      .from('email_verifications')
      .insert([{
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        code: verificationCode,
        user_id: userId,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Send verification email
    const emailService = require('../../services/emailService');
    const { data: user } = await supabase.from('users').select('first_name').eq('id', userId).single();
    
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
    const { data: verification, error: verifyError } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (verifyError || !verification) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      });
    }

    // Update user with email and password
    const { data: user, error: updateError } = await supabase
      .from('users')
      .update({
        email: verification.email,
        password_hash: verification.password_hash,
        email_verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Clean up verification record
    await supabase
      .from('email_verifications')
      .delete()
      .eq('email', email.toLowerCase());

    res.json({
      success: true,
      message: 'Email verified and added successfully',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          phone: user.phone,
          profile_completed: user.profile_completed || false,
          emailVerified: user.email_verified || false,
          phoneVerified: user.phone_verified || false
        }
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
    const { phone, email, password } = req.body;

    if (!phone && !email) {
      return res.status(400).json({
        success: false,
        message: 'Phone or email is required'
      });
    }

    // Find user
    let query = supabase.from('users').select('*');
    
    if (phone) {
      query = query.eq('phone', phone);
    } else {
      query = query.eq('email', email.toLowerCase());
    }

    const { data: user, error } = await query.single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // If logging in with email, verify password
    if (email && password) {
      if (!user.password_hash) {
        return res.status(401).json({
          success: false,
          message: 'Password not set for this account'
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password'
        });
      }
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Generate new tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Update refresh token in database
    await supabase
      .from('users')
      .update({ 
        refresh_token: refreshToken,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          phone: user.phone,
          profile_completed: user.profile_completed || false,
          emailVerified: user.email_verified || false,
          phoneVerified: user.phone_verified || false
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const userId = req.userId;

    // Clear refresh token from database
    await supabase
      .from('users')
      .update({ refresh_token: null })
      .eq('id', userId);

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

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Check if refresh token exists in database
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('refresh_token', refreshToken)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    // Update refresh token in database
    await supabase
      .from('users')
      .update({ refresh_token: newRefreshToken })
      .eq('id', user.id);

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, first_name, email')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        message: 'If the email exists, a reset code has been sent'
      });
    }

    // Generate reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Store reset code
    await supabase
      .from('password_resets')
      .insert([{
        user_id: user.id,
        email: email.toLowerCase(),
        code: resetCode,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      }]);

    // Send reset email
    const emailService = require('../../services/emailService');
    await emailService.sendPasswordResetEmail(email, resetCode, user.first_name);

    res.json({
      success: true,
      message: 'If the email exists, a reset code has been sent',
      ...(process.env.NODE_ENV === 'development' && { testCode: resetCode })
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process request'
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
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

    // Verify reset code
    const { data: resetRecord, error: resetError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (resetError || !resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset code'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    await supabase
      .from('users')
      .update({ 
        password_hash: hashedPassword,
        refresh_token: null, // Logout from all devices
        updated_at: new Date().toISOString()
      })
      .eq('id', resetRecord.user_id);

    // Clean up reset record
    await supabase
      .from('password_resets')
      .delete()
      .eq('email', email.toLowerCase());

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password'
    });
  }
};

// Change password (authenticated)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'No password set for this account'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await supabase
      .from('users')
      .update({ 
        password_hash: hashedNewPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

// Google OAuth login
const googleLogin = async (req, res) => {
  try {
    const { googleToken, firstName, lastName, email, googleId } = req.body;

    if (!googleToken || !email || !googleId) {
      return res.status(400).json({
        success: false,
        message: 'Google token, email, and Google ID are required'
      });
    }

    // TODO: In production, verify Google token with Google API
    // For now, we'll trust the client-side verification

    // Check if user exists by Google ID first
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // If not found by Google ID, check by email
    if (!user) {
      const { data: emailUser, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (emailError && emailError.code !== 'PGRST116') {
        throw emailError;
      }

      if (emailUser) {
        // Link Google account to existing user
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            google_id: googleId,
            updated_at: new Date().toISOString()
          })
          .eq('id', emailUser.id)
          .select()
          .single();

        if (updateError) throw updateError;
        user = updatedUser;
      }
    }

    // Create user if doesn't exist
    if (!user) {
      const userId = uuidv4();
      const refreshToken = generateRefreshToken(userId);

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          google_id: googleId,
          email_verified: true,
          is_active: true,
          refresh_token: refreshToken,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) throw createError;
      user = newUser;
    }

    // Generate tokens
    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Update refresh token and last login
    await supabase
      .from('users')
      .update({ 
        refresh_token: refreshToken,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          phone: user.phone,
          profile_completed: user.profile_completed || false,
          emailVerified: user.email_verified || false,
          phoneVerified: user.phone_verified || false
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({
      success: false,
      message: 'Google login failed'
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
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  googleLogin
};