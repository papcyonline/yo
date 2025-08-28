/**
 * Password Reset Service
 * =====================
 * 
 * Handles secure password reset functionality with email verification
 * Includes token generation, email sending, and password updates
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const emailService = require('./emailService');

class PasswordResetService {
    constructor() {
        // Token expires in 1 hour
        this.TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
        this.MAX_RESET_ATTEMPTS = 3; // Max reset attempts per day
        this.RESET_COOLDOWN = 15 * 60 * 1000; // 15 minutes between reset requests
        
        console.log('🔐 Password Reset Service initialized');
    }
    
    /**
     * Generate secure reset token
     */
    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Request password reset
     */
    async requestPasswordReset(email) {
        try {
            const user = await User.findOne({ email: email.toLowerCase() });
            
            if (!user) {
                // Don't reveal whether user exists for security
                return {
                    success: true,
                    message: 'If an account with that email exists, a password reset link has been sent.'
                };
            }
            
            // Check rate limiting
            const rateLimitCheck = await this.checkRateLimit(user._id);
            if (!rateLimitCheck.allowed) {
                return {
                    success: false,
                    message: rateLimitCheck.message,
                    code: 'RATE_LIMITED'
                };
            }
            
            // Generate reset token
            const resetToken = this.generateResetToken();
            const resetTokenExpiry = new Date(Date.now() + this.TOKEN_EXPIRY);
            
            // Update user with reset token
            await User.findByIdAndUpdate(user._id, {
                resetPasswordToken: resetToken,
                resetPasswordExpires: resetTokenExpiry,
                $inc: { 'passwordResetAttempts.count': 1 },
                $set: { 
                    'passwordResetAttempts.lastAttempt': new Date(),
                    'passwordResetAttempts.lastIP': null // Would be set from request IP
                }
            });
            
            // Send reset email
            const emailSent = await this.sendResetEmail(user, resetToken);
            
            if (!emailSent) {
                console.error('Failed to send password reset email');
                return {
                    success: false,
                    message: 'Failed to send password reset email. Please try again later.',
                    code: 'EMAIL_FAILED'
                };
            }
            
            console.log(`📧 Password reset email sent to ${email}`);
            
            return {
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.',
                tokenExpiry: resetTokenExpiry
            };
            
        } catch (error) {
            console.error('Password reset request failed:', error);
            return {
                success: false,
                message: 'Internal server error. Please try again later.',
                error: error.message
            };
        }
    }
    
    /**
     * Check rate limiting for password reset attempts
     */
    async checkRateLimit(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                return { allowed: false, message: 'User not found' };
            }
            
            const now = new Date();
            const lastAttempt = user.passwordResetAttempts?.lastAttempt;
            const attemptCount = user.passwordResetAttempts?.count || 0;
            
            // Reset daily counter if it's a new day
            if (lastAttempt && lastAttempt.toDateString() !== now.toDateString()) {
                await User.findByIdAndUpdate(userId, {
                    $set: { 'passwordResetAttempts.count': 0 }
                });
                return { allowed: true };
            }
            
            // Check daily limit
            if (attemptCount >= this.MAX_RESET_ATTEMPTS) {
                return {
                    allowed: false,
                    message: 'Too many password reset attempts. Please try again tomorrow.'
                };
            }
            
            // Check cooldown period
            if (lastAttempt && (now - lastAttempt) < this.RESET_COOLDOWN) {
                const remainingTime = Math.ceil((this.RESET_COOLDOWN - (now - lastAttempt)) / 60000);
                return {
                    allowed: false,
                    message: `Please wait ${remainingTime} minutes before requesting another password reset.`
                };
            }
            
            return { allowed: true };
            
        } catch (error) {
            console.error('Rate limit check failed:', error);
            return { allowed: true }; // Allow on error to avoid blocking users
        }
    }
    
    /**
     * Send password reset email
     */
    async sendResetEmail(user, resetToken) {
        try {
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
            
            const emailTemplate = {
                to: user.email,
                subject: 'Password Reset Request - Yo! App',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Yo! App</h1>
                        </div>
                        
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Hi ${user.first_name},
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                We received a request to reset your password for your Yo! account. 
                                If you made this request, click the button below to reset your password:
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${resetUrl}" 
                                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                          color: white; 
                                          padding: 12px 30px; 
                                          text-decoration: none; 
                                          border-radius: 5px; 
                                          display: inline-block; 
                                          font-weight: bold;">
                                    Reset My Password
                                </a>
                            </div>
                            
                            <p style="color: #666; line-height: 1.6;">
                                This link will expire in 1 hour for security reasons.
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                If you didn't request this password reset, you can safely ignore this email. 
                                Your password will remain unchanged.
                            </p>
                            
                            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                            
                            <p style="color: #999; font-size: 12px;">
                                For security reasons, this link can only be used once and expires in 1 hour.
                                <br>If you're having trouble with the button, copy and paste this link into your browser:
                                <br><a href="${resetUrl}" style="color: #667eea;">${resetUrl}</a>
                            </p>
                        </div>
                        
                        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                            © 2024 Yo! App. All rights reserved.
                        </div>
                    </div>
                `,
                text: `
                    Hi ${user.first_name},
                    
                    We received a request to reset your password for your Yo! account.
                    
                    To reset your password, visit this link: ${resetUrl}
                    
                    This link will expire in 1 hour for security reasons.
                    
                    If you didn't request this password reset, you can safely ignore this email.
                    
                    - The Yo! App Team
                `
            };
            
            // Use email service if available, otherwise log for development
            if (emailService && typeof emailService.sendEmail === 'function') {
                const result = await emailService.sendEmail(emailTemplate);
                return result.success;
            } else {
                // Development mode - log email instead of sending
                console.log('📧 Password Reset Email (Development Mode):');
                console.log(`To: ${emailTemplate.to}`);
                console.log(`Subject: ${emailTemplate.subject}`);
                console.log(`Reset URL: ${resetUrl}`);
                console.log(`Token: ${resetToken}`);
                return true;
            }
            
        } catch (error) {
            console.error('Failed to send password reset email:', error);
            return false;
        }
    }
    
    /**
     * Verify reset token and reset password
     */
    async resetPassword(token, newPassword) {
        try {
            // Validate input
            if (!token || !newPassword) {
                return {
                    success: false,
                    message: 'Reset token and new password are required.',
                    code: 'INVALID_INPUT'
                };
            }
            
            // Validate password strength
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.valid) {
                return {
                    success: false,
                    message: passwordValidation.message,
                    code: 'WEAK_PASSWORD'
                };
            }
            
            // Find user with valid reset token
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: new Date() }
            });
            
            if (!user) {
                return {
                    success: false,
                    message: 'Password reset token is invalid or has expired.',
                    code: 'INVALID_TOKEN'
                };
            }
            
            // Hash new password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
            
            // Update user password and clear reset token
            await User.findByIdAndUpdate(user._id, {
                password: hashedPassword,
                $unset: {
                    resetPasswordToken: 1,
                    resetPasswordExpires: 1
                },
                $set: {
                    passwordChangedAt: new Date(),
                    'passwordResetAttempts.count': 0 // Reset attempt counter
                }
            });
            
            console.log(`🔐 Password successfully reset for user ${user.email}`);
            
            // Send confirmation email
            await this.sendPasswordResetConfirmation(user);
            
            return {
                success: true,
                message: 'Your password has been successfully reset. You can now log in with your new password.',
                userId: user._id
            };
            
        } catch (error) {
            console.error('Password reset failed:', error);
            return {
                success: false,
                message: 'Internal server error. Please try again later.',
                error: error.message
            };
        }
    }
    
    /**
     * Validate password strength
     */
    validatePassword(password) {
        if (!password || password.length < 8) {
            return {
                valid: false,
                message: 'Password must be at least 8 characters long.'
            };
        }
        
        if (!/(?=.*[a-z])/.test(password)) {
            return {
                valid: false,
                message: 'Password must contain at least one lowercase letter.'
            };
        }
        
        if (!/(?=.*[A-Z])/.test(password)) {
            return {
                valid: false,
                message: 'Password must contain at least one uppercase letter.'
            };
        }
        
        if (!/(?=.*\d)/.test(password)) {
            return {
                valid: false,
                message: 'Password must contain at least one number.'
            };
        }
        
        if (!/(?=.*[@$!%*?&])/.test(password)) {
            return {
                valid: false,
                message: 'Password must contain at least one special character (@$!%*?&).'
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Send password reset confirmation email
     */
    async sendPasswordResetConfirmation(user) {
        try {
            const emailTemplate = {
                to: user.email,
                subject: 'Password Successfully Reset - Yo! App',
                html: `
                    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
                        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">Yo! App</h1>
                        </div>
                        
                        <div style="padding: 30px; background: #f9f9f9;">
                            <h2 style="color: #333; margin-bottom: 20px;">Password Successfully Reset</h2>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Hi ${user.first_name},
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                Your password has been successfully reset. You can now log in to your Yo! account with your new password.
                            </p>
                            
                            <p style="color: #666; line-height: 1.6;">
                                If you did not make this change, please contact our support team immediately.
                            </p>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                          color: white; 
                                          padding: 12px 30px; 
                                          text-decoration: none; 
                                          border-radius: 5px; 
                                          display: inline-block; 
                                          font-weight: bold;">
                                    Sign In Now
                                </a>
                            </div>
                        </div>
                        
                        <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
                            © 2024 Yo! App. All rights reserved.
                        </div>
                    </div>
                `,
                text: `
                    Hi ${user.first_name},
                    
                    Your password has been successfully reset. You can now log in to your Yo! account with your new password.
                    
                    If you did not make this change, please contact our support team immediately.
                    
                    - The Yo! App Team
                `
            };
            
            if (emailService && typeof emailService.sendEmail === 'function') {
                await emailService.sendEmail(emailTemplate);
            } else {
                console.log('📧 Password Reset Confirmation (Development Mode)');
                console.log(`To: ${emailTemplate.to}`);
                console.log(`Subject: ${emailTemplate.subject}`);
            }
            
        } catch (error) {
            console.error('Failed to send password reset confirmation:', error);
        }
    }
    
    /**
     * Verify reset token validity without resetting password
     */
    async verifyResetToken(token) {
        try {
            const user = await User.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gt: new Date() }
            });
            
            return {
                valid: !!user,
                userId: user?._id,
                expiresAt: user?.resetPasswordExpires
            };
            
        } catch (error) {
            console.error('Token verification failed:', error);
            return { valid: false };
        }
    }
    
    /**
     * Clean up expired reset tokens (should be run periodically)
     */
    async cleanupExpiredTokens() {
        try {
            const result = await User.updateMany(
                { resetPasswordExpires: { $lt: new Date() } },
                { 
                    $unset: {
                        resetPasswordToken: 1,
                        resetPasswordExpires: 1
                    }
                }
            );
            
            console.log(`🧹 Cleaned up ${result.modifiedCount} expired password reset tokens`);
            
            return result.modifiedCount;
            
        } catch (error) {
            console.error('Token cleanup failed:', error);
            return 0;
        }
    }
}

// Create singleton instance
const passwordResetService = new PasswordResetService();

module.exports = {
    passwordResetService,
    PasswordResetService
};