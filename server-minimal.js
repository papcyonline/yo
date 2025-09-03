const dotenv = require('dotenv');

// CRITICAL: Load environment variables FIRST
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

// Swagger documentation setup
const { swaggerDocument, swaggerUi, swaggerOptions } = require('./config/swagger-simple');

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // Allow any localhost or local network IP
    const allowedPatterns = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    callback(null, isAllowed || true); // Allow all in development
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    message: 'Yo! Family API is running'
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Redirect /docs to /api-docs for convenience
app.get('/docs', (req, res) => {
  res.redirect('/api-docs');
});

// Test authentication route (minimal)
app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Login endpoint - under development',
    data: {
      note: 'This is a minimal server for testing Swagger documentation',
      fullServerRequired: 'Run npm start for the complete API'
    }
  });
});

// Test users route (minimal)
app.get('/api/users/profile', (req, res) => {
  res.json({
    success: true,
    message: 'Profile endpoint - under development',
    data: {
      note: 'This is a minimal server for testing Swagger documentation',
      fullServerRequired: 'Run npm start for the complete API'
    }
  });
});

// Test matching route (minimal)
app.get('/api/matching', (req, res) => {
  res.json({
    success: true,
    message: 'Matching endpoint - under development',
    data: {
      note: 'This is a minimal server for testing Swagger documentation',
      fullServerRequired: 'Run npm start for the complete API'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /api-docs',
      'GET /docs',
      'POST /api/auth/login',
      'GET /api/users/profile',
      'GET /api/matching'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 9002;

// Only start server when this file is run directly, not when imported for testing
if (require.main === module) {
  server.listen(PORT, () => {
    console.log('🚀 Yo! Family API - Minimal Server');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`📚 Docs shortcut: http://localhost:${PORT}/docs`);
    console.log('');
    console.log('📋 Available endpoints:');
    console.log('  GET  /health              - Health check');
    console.log('  GET  /api-docs            - Swagger documentation');
    console.log('  POST /api/auth/login      - Test login endpoint');
    console.log('  GET  /api/users/profile   - Test profile endpoint');  
    console.log('  GET  /api/matching        - Test matching endpoint');
    console.log('');
    console.log('ℹ️  This is a minimal server for testing Swagger documentation.');
    console.log('ℹ️  For the full API with all features, fix the main server.js');
  });
}

// Export the app for testing
module.exports = app;