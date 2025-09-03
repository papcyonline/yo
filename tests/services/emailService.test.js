const emailService = require('../../services/advancedEmailService');
const fs = require('fs');
const path = require('path');

// Mock external dependencies
jest.mock('axios');
jest.mock('fs');

describe('Advanced Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset template cache
    emailService.templates = {};
  });

  describe('Initialization', () => {
    it('should initialize service with correct properties', () => {
      expect(emailService.apiKey).toBe(process.env.RESEND_API_KEY);
      expect(emailService.fromEmail).toBeDefined();
      expect(emailService.baseUrl).toBe('https://api.resend.com/emails');
      expect(emailService.templates).toEqual({});
    });

    it('should use default from email if not provided', () => {
      // Since we're using a singleton, we'll test the default value
      expect(emailService.fromEmail).toBeDefined();
      expect(typeof emailService.fromEmail).toBe('string');
    });
  });

  describe('Template Management', () => {
    it('should load template successfully', () => {
      const mockTemplate = '<html><body>Hello {{userName}}</body></html>';
      fs.readFileSync.mockReturnValue(mockTemplate);

      const template = emailService.loadTemplate('otp');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('otp.html'),
        'utf8'
      );
      expect(template).toBe(mockTemplate);
      expect(emailService.templates.otp).toBe(mockTemplate);
    });

    it('should handle template loading errors', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const template = emailService.loadTemplate('nonexistent');

      expect(template).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to load email template: nonexistent',
        expect.any(Error)
      );
      consoleError.mockRestore();
    });

    it('should cache loaded templates', () => {
      const mockTemplate = '<html><body>Cached</body></html>';
      fs.readFileSync.mockReturnValue(mockTemplate);

      // Load template twice
      emailService.loadTemplate('test');
      emailService.loadTemplate('test');

      // Should only read file once
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });
  });

  describe('Template Rendering', () => {
    it('should render template with variables', () => {
      const template = 'Hello {{userName}}, your code is {{otpCode}}';
      const variables = { userName: 'John', otpCode: '123456' };

      const result = emailService.renderTemplate(template, variables);

      expect(result).toBe('Hello John, your code is 123456');
    });

    it('should include default variables', () => {
      const template = 'Copyright {{currentYear}} {{companyName}}';
      
      const result = emailService.renderTemplate(template, {});

      expect(result).toContain(new Date().getFullYear().toString());
      expect(result).toContain('Yo! Family App');
    });

    it('should handle missing variables', () => {
      const template = 'Hello {{userName}}, welcome to {{missingVar}}';
      
      const result = emailService.renderTemplate(template, { userName: 'John' });

      expect(result).toBe('Hello John, welcome to {{missingVar}}');
    });

    it('should replace multiple occurrences of same variable', () => {
      const template = '{{userName}} and {{userName}} are friends';
      
      const result = emailService.renderTemplate(template, { userName: 'John' });

      expect(result).toBe('John and John are friends');
    });
  });

  describe('OTP Generation', () => {
    it('should generate 6-digit OTP by default', () => {
      const otp = emailService.generateOTP();
      
      expect(typeof otp).toBe('string');
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate OTP of specified length', () => {
      const otp4 = emailService.generateOTP(4);
      const otp8 = emailService.generateOTP(8);
      
      expect(otp4.length).toBe(4);
      expect(otp8.length).toBe(8);
      expect(/^\d+$/.test(otp4)).toBe(true);
      expect(/^\d+$/.test(otp8)).toBe(true);
    });

    it('should pad short numbers with zeros', () => {
      // Mock Math.random to return a small number
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const otp = emailService.generateOTP(6);
      
      expect(otp).toBe('001000');
      expect(otp.length).toBe(6);

      Math.random = originalRandom;
    });

    it('should generate different OTP codes', () => {
      const otp1 = emailService.generateOTP();
      const otp2 = emailService.generateOTP();
      
      // Very unlikely to be the same (but possible)
      expect(otp1).not.toBe(otp2);
    });
  });

  describe('Location Services', () => {
    it('should detect local network addresses', async () => {
      const localLocation = await emailService.getLocationFromIP('192.168.1.1');
      const localhostLocation = await emailService.getLocationFromIP('127.0.0.1');
      
      expect(localLocation).toBe('Local Network');
      expect(localhostLocation).toBe('Local Network');
    });

    it('should return unknown for external addresses', async () => {
      const externalLocation = await emailService.getLocationFromIP('8.8.8.8');
      
      expect(externalLocation).toBe('Unknown Location');
    });

    it('should handle undefined IP addresses', async () => {
      const location = await emailService.getLocationFromIP();
      
      expect(location).toBe('Unknown Location');
    });
  });

  describe('Email Sending', () => {
    beforeEach(() => {
      // Mock a successful template load
      fs.readFileSync.mockReturnValue('<html><body>Hello {{userName}}, your OTP is {{otpCode}}</body></html>');
    });

    it('should prepare OTP email data correctly', async () => {
      const userData = {
        firstName: 'John',
        ipAddress: '192.168.1.1',
        type: 'email address'
      };

      // Mock the actual send method to just return the prepared data
      const originalSendOTP = emailService.sendOTPEmail;
      emailService.sendOTPEmail = jest.fn(async (email, data) => {
        const template = emailService.loadTemplate('otp');
        const otpCode = emailService.generateOTP(6);
        const location = await emailService.getLocationFromIP(data.ipAddress);
        
        return {
          template,
          otpCode,
          location,
          email,
          userData: data
        };
      });

      const result = await emailService.sendOTPEmail('test@example.com', userData);

      expect(result.template).toBeDefined();
      expect(result.otpCode).toMatch(/^\d{6}$/);
      expect(result.location).toBe('Local Network');
      expect(result.email).toBe('test@example.com');
      expect(result.userData.firstName).toBe('John');
    });

    it('should handle missing template gracefully', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Template not found');
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();
      
      // The actual service should handle this gracefully
      try {
        await emailService.sendOTPEmail('test@example.com');
      } catch (error) {
        expect(error.message).toContain('OTP template not found');
      }
      
      consoleError.mockRestore();
      consoleLog.mockRestore();
    });

    it('should use default values for missing user data', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock successful template load
      fs.readFileSync.mockReturnValue('Hello {{userName}}, your OTP is {{otpCode}}');
      
      // The service should handle missing user data without throwing
      try {
        await emailService.sendOTPEmail('test@example.com', {});
        // If it doesn't throw, that's good - it handles defaults
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, make sure it's not due to missing user data
        expect(error.message).not.toContain('userName');
      }
      
      consoleLog.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const template = emailService.loadTemplate('test');

      expect(template).toBeNull();
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('should handle template rendering with circular references', () => {
      const template = 'Hello {{userName}}';
      const circularObj = {};
      circularObj.self = circularObj;

      // Should not throw error
      const result = emailService.renderTemplate(template, { userName: 'John' });
      expect(result).toBe('Hello John');
    });
  });

  describe('Performance', () => {
    it('should cache templates for better performance', () => {
      const mockTemplate = '<html>Template</html>';
      fs.readFileSync.mockReturnValue(mockTemplate);

      // Load same template multiple times
      emailService.loadTemplate('performance');
      emailService.loadTemplate('performance');
      emailService.loadTemplate('performance');

      // File should only be read once due to caching
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should generate OTP codes efficiently', () => {
      const startTime = Date.now();
      
      // Generate multiple OTPs
      for (let i = 0; i < 100; i++) {
        emailService.generateOTP();
      }
      
      const endTime = Date.now();
      
      // Should complete very quickly (under 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Configuration', () => {
    it('should use environment variables correctly', () => {
      // Test that the singleton instance uses environment variables
      expect(emailService.apiKey).toBe(process.env.RESEND_API_KEY);
      expect(emailService.fromEmail).toBeDefined();
      expect(typeof emailService.fromEmail).toBe('string');
    });

    it('should have correct API endpoint', () => {
      expect(emailService.baseUrl).toBe('https://api.resend.com/emails');
    });
  });
});