// Global test setup for Yo! Family Backend
const mongoose = require('mongoose');

// Increase test timeout
jest.setTimeout(30000);

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.BCRYPT_SALT_ROUNDS = '10';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.EMAIL_SERVICE = 'test';
process.env.EMAIL_USER = 'test@example.com';
process.env.EMAIL_PASS = 'test-password';

// Mock external services
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(() => Promise.resolve({
        public_id: 'test-image-id',
        secure_url: 'https://test.cloudinary.com/test-image.jpg',
        width: 800,
        height: 600
      })),
      destroy: jest.fn(() => Promise.resolve({ result: 'ok' }))
    }
  }
}));

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    disconnect: jest.fn(() => Promise.resolve()),
    get: jest.fn(() => Promise.resolve(null)),
    set: jest.fn(() => Promise.resolve('OK')),
    del: jest.fn(() => Promise.resolve(1)),
    exists: jest.fn(() => Promise.resolve(0)),
    expire: jest.fn(() => Promise.resolve(1)),
    flushall: jest.fn(() => Promise.resolve('OK')),
    on: jest.fn(),
    quit: jest.fn(() => Promise.resolve())
  }))
}));

// Mock Nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(() => Promise.resolve({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
      rejected: []
    })),
    verify: jest.fn(() => Promise.resolve(true))
  }))
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: 'Test AI response'
            }
          }]
        }))
      }
    }
  }));
});

// Mock Socket.IO
jest.mock('socket.io', () => ({
  Server: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    to: jest.fn(() => ({
      emit: jest.fn()
    })),
    sockets: {
      emit: jest.fn()
    }
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(() => Promise.resolve(Buffer.from('mock file content'))),
    writeFile: jest.fn(() => Promise.resolve()),
    unlink: jest.fn(() => Promise.resolve()),
    mkdir: jest.fn(() => Promise.resolve())
  },
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => Buffer.from('mock file content')),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock Multer for file uploads
jest.mock('multer', () => {
  const multer = () => ({
    single: jest.fn(() => (req, res, next) => {
      req.file = {
        fieldname: 'image',
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 12345,
        buffer: Buffer.from('fake image data'),
        filename: 'test-12345.jpg',
        path: '/tmp/test-12345.jpg'
      };
      next();
    }),
    array: jest.fn(() => (req, res, next) => {
      req.files = [
        {
          fieldname: 'images',
          originalname: 'test1.jpg',
          mimetype: 'image/jpeg',
          size: 12345,
          buffer: Buffer.from('fake image data 1'),
          filename: 'test1-12345.jpg',
          path: '/tmp/test1-12345.jpg'
        }
      ];
      next();
    })
  });
  
  multer.memoryStorage = jest.fn();
  multer.diskStorage = jest.fn();
  
  return multer;
});

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Suppress console.log during tests unless explicitly needed
const originalConsole = console.log;
console.log = (...args) => {
  if (process.env.VERBOSE_TESTS === 'true') {
    originalConsole(...args);
  }
};

// Helper function to create test database connection
global.connectTestDB = async () => {
  // Use a simple in-memory connection for testing
  const mongoUri = global.__MONGO_URI__ || 'mongodb://localhost:27017/yofam-test';
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  
  return null; // No mongo server to return
};

// Helper function to clean up test database  
global.disconnectTestDB = async (mongoServer) => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

// Helper function to create test user data
global.createTestUser = () => ({
  email: 'test@example.com',
  phone: '+1234567890',
  fullName: 'Test User',
  password: 'TestPassword123!',
  phoneVerified: true,
  emailVerified: true,
  profile_completed: false,
  languagePreference: 'en'
});

// Helper function to create test auth headers
global.createAuthHeaders = (token) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
});

// Helper function to generate test JWT token
global.generateTestToken = (userId = 'test-user-id') => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};