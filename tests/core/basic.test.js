const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

describe('Core Functionality Tests', () => {
  describe('JWT Operations', () => {
    it('should create and verify JWT tokens', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should handle token expiration', (done) => {
      const payload = { userId: '123' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1ms' });
      
      setTimeout(() => {
        try {
          jwt.verify(token, process.env.JWT_SECRET);
          done(new Error('Token should have expired'));
        } catch (error) {
          expect(error.name).toBe('TokenExpiredError');
          done();
        }
      }, 10);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        jwt.verify('invalid-token', process.env.JWT_SECRET);
      }).toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(password.length);
      expect(hashedPassword.startsWith('$2')).toBe(true);
    });

    it('should verify passwords correctly', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const isMatch = await bcrypt.compare(password, hashedPassword);
      const isNotMatch = await bcrypt.compare('WrongPassword', hashedPassword);
      
      expect(isMatch).toBe(true);
      expect(isNotMatch).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);
      
      expect(hash1).not.toBe(hash2);
      
      // Both should still verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });

  describe('Input Validation', () => {
    const userSchema = Joi.object({
      email: Joi.string().email().required(),
      phone: Joi.string().pattern(/^\+[1-9]\d{8,14}$/).required(),
      fullName: Joi.string().min(2).max(50).required(),
      password: Joi.string().min(8).required()
    });

    it('should validate correct user data', () => {
      const userData = {
        email: 'test@example.com',
        phone: '+1234567890',
        fullName: 'Test User',
        password: 'TestPassword123!'
      };

      const { error, value } = userSchema.validate(userData);
      
      expect(error).toBeUndefined();
      expect(value.email).toBe(userData.email);
      expect(value.fullName).toBe(userData.fullName);
    });

    it('should reject invalid email', () => {
      const userData = {
        email: 'invalid-email',
        phone: '+1234567890',
        fullName: 'Test User',
        password: 'TestPassword123!'
      };

      const { error } = userSchema.validate(userData);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    it('should reject short passwords', () => {
      const userData = {
        email: 'test@example.com',
        phone: '+1234567890',
        fullName: 'Test User',
        password: 'short'
      };

      const { error } = userSchema.validate(userData);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('password');
    });

    it('should reject invalid phone numbers', () => {
      const userData = {
        email: 'test@example.com',
        phone: '1234567890', // Missing country code
        fullName: 'Test User',
        password: 'TestPassword123!'
      };

      const { error } = userSchema.validate(userData);
      
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('phone');
    });
  });

  describe('Environment Configuration', () => {
    it('should have required environment variables', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET.length).toBeGreaterThan(10);
      expect(process.env.BCRYPT_SALT_ROUNDS).toBeDefined();
      expect(parseInt(process.env.BCRYPT_SALT_ROUNDS)).toBeGreaterThan(0);
    });

    it('should have test environment configured', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });
  });

  describe('Utility Functions', () => {
    const generateOTP = (length = 6) => {
      return Math.random().toString().substr(2, length).padEnd(length, '0');
    };

    const sanitizeString = (str) => {
      return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<[^>]*>?/gm, '')
        .trim();
    };

    it('should generate OTP codes', () => {
      const otp = generateOTP();
      
      expect(typeof otp).toBe('string');
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate OTP of custom length', () => {
      const otp4 = generateOTP(4);
      const otp8 = generateOTP(8);
      
      expect(otp4.length).toBe(4);
      expect(otp8.length).toBe(8);
      expect(/^\d+$/.test(otp4)).toBe(true);
      expect(/^\d+$/.test(otp8)).toBe(true);
    });

    it('should sanitize XSS attempts', () => {
      const maliciousInput = '<script>alert("XSS")</script>Hello World<b>Bold</b>';
      const sanitized = sanitizeString(maliciousInput);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<b>');
      expect(sanitized).toContain('Hello World');
      expect(sanitized).toContain('Bold');
    });
  });

  describe('Data Processing', () => {
    it('should process user registration data', () => {
      const rawData = {
        email: '  TEST@EXAMPLE.COM  ',
        phone: '+1234567890',
        fullName: '  John Doe  ',
        password: 'Password123!',
        extraField: 'should be removed'
      };

      const processedData = {
        email: rawData.email.toLowerCase().trim(),
        phone: rawData.phone,
        fullName: rawData.fullName.trim(),
        password: rawData.password
      };

      expect(processedData.email).toBe('test@example.com');
      expect(processedData.fullName).toBe('John Doe');
      expect(processedData.extraField).toBeUndefined();
    });

    it('should validate API response format', () => {
      const createApiResponse = (success, data, message, errors) => {
        const response = { success };
        if (message) response.message = message;
        if (data) response.data = data;
        if (errors) response.errors = errors;
        return response;
      };

      const successResponse = createApiResponse(true, { userId: '123' }, 'Success');
      const errorResponse = createApiResponse(false, null, 'Validation failed', [
        { field: 'email', message: 'Invalid email' }
      ]);

      expect(successResponse.success).toBe(true);
      expect(successResponse.data.userId).toBe('123');
      expect(successResponse.message).toBe('Success');

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.errors[0].field).toBe('email');
    });
  });

  describe('Date and Time Operations', () => {
    it('should handle OTP expiration times', () => {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes

      expect(expiryTime.getTime()).toBeGreaterThan(now.getTime());
      
      const timeDifference = expiryTime.getTime() - now.getTime();
      expect(timeDifference).toBe(10 * 60 * 1000); // Exactly 10 minutes
    });

    it('should validate timestamp formats', () => {
      const timestamp = new Date().toISOString();
      
      expect(typeof timestamp).toBe('string');
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      
      const parsed = new Date(timestamp);
      expect(parsed.toISOString()).toBe(timestamp);
    });
  });

  describe('Error Handling', () => {
    it('should create structured error objects', () => {
      const createError = (message, code, details) => {
        const error = new Error(message);
        error.code = code;
        error.details = details;
        return error;
      };

      const validationError = createError('Validation failed', 'VALIDATION_ERROR', {
        field: 'email',
        value: 'invalid-email'
      });

      expect(validationError.message).toBe('Validation failed');
      expect(validationError.code).toBe('VALIDATION_ERROR');
      expect(validationError.details.field).toBe('email');
    });

    it('should handle async errors correctly', async () => {
      const asyncFunction = async (shouldFail) => {
        if (shouldFail) {
          throw new Error('Async operation failed');
        }
        return 'success';
      };

      // Test success case
      const result = await asyncFunction(false);
      expect(result).toBe('success');

      // Test error case
      await expect(asyncFunction(true)).rejects.toThrow('Async operation failed');
    });
  });
});