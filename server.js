const dotenv = require('dotenv');

// CRITICAL: Load environment variables FIRST before importing other modules
dotenv.config();

// Configure Cloudinary
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const rateLimit = require('./middleware/rateLimit');
const ChatService = require('./services/ChatService');
const { logger, requestLogger, errorLogger } = require('./config/logger');
const { handleUploadError } = require('./middleware/uploadValidation');

// Swagger documentation setup
const { swaggerDocument, swaggerUi, swaggerOptions } = require('./config/swagger-simple');

// Database connections
const { connectMongoDB, testMongoConnection } = require('./config/mongodb');
// const redisClient = require('./config/redis'); // Keep Redis disabled for now

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = socketIo(server, {
  cors: {
    origin: function (origin, callback) {
      // Same CORS logic as Express
      if (!origin) return callback(null, true);
      
      const allowedPatterns = [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
        /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/
      ];
      
      const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
      callback(null, isAllowed || process.env.NODE_ENV === 'development');
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Initialize Chat Service (TEMPORARILY DISABLED FOR DEBUGGING)
// const chatService = new ChatService(io);
// app.locals.chatService = chatService;

// Connect Socket.io to Enhanced Matching Service for real-time updates (TEMPORARILY DISABLED FOR DEBUGGING)
// const { enhancedMatchingService } = require('./services/aiMatchingService');
// enhancedMatchingService.setSocketIO(io);

// Security middleware
app.use(helmet());

// CORS configuration for development
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
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Still allow in development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Logging - Replace Morgan with Winston
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads (images, documents, etc.)
app.use('/uploads', express.static('uploads'));

// Rate limiting
app.use('/api/', rateLimit.general);

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Health check endpoint
 *     description: Returns server health status and basic information
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

// Redirect /docs to /api-docs for convenience
app.get('/docs', (req, res) => {
  res.redirect('/api-docs');
});

// Serve temporary status images (24hr expiry)
const path = require('path');
app.use('/temp', express.static(path.join(__dirname, 'temp')));

// Temporarily disable MongoDB routes for debugging
console.log('📡 DEBUGGING MODE - Routes disabled to test server startup');

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running without database',
    timestamp: new Date().toISOString()
  });
});

// MongoDB-only routes (Re-enabling auth for login functionality)
console.log('📡 Re-enabling auth routes for login functionality');
app.use('/api/auth', require('./routes/auth/mongodb'));
app.use('/api/users', require('./routes/users-router')); // User profile endpoints
app.use('/api/status', require('./routes/status')); // Status/Posts feature
app.use('/api/settings', require('./routes/settings-router')); // Settings & Legal pages
app.use('/api/notifications', require('./routes/notifications-router')); // Notifications
app.use('/api/friends', require('./routes/friends-router')); // Friends management
app.use('/api/chats', require('./routes/chats-router')); // Chat endpoints
// app.use('/api/unified-onboarding', require('./routes/unified-onboarding')); // Unified onboarding endpoints
app.use('/api/matching', require('./routes/matching-router')); // Matching endpoints
app.use('/api/ai', require('./routes/ai-router')); // AI endpoints
app.use('/api/communities', require('./routes/communities-router')); // Communities
app.use('/api/genealogy', require('./routes/genealogy')); // Family Tree/Genealogy
// app.use('/api/family-community', require('./routes/familyTreeCommunity')); // Family Tree Community Integration - Removed: Users can create communities instead

// TODO: Re-enable other routes after fixing them
// app.use('/api/safety', require('./routes/safety'));
// app.use('/api/verification', require('./routes/verification')); // Blue check verification

// Additional routes (uncommented and fixed)
console.log('📡 Loading additional routes...');

// Check if route files exist before requiring them
const routeFiles = [
  { path: './routes/voice', mount: '/api/voice' },
  { path: './routes/calls', mount: '/api/calls' },
  { path: './routes/social', mount: '/api/social' },
  { path: './routes/admin', mount: '/api/admin' },
  { path: './routes/media', mount: '/api/media' },
  { path: './routes/dashboard', mount: '/api/dashboard' }
];

routeFiles.forEach(({ path, mount }) => {
  try {
    const routeModule = require(path);
    app.use(mount, routeModule);
    console.log(`✅ Loaded route: ${mount}`);
  } catch (error) {
    console.log(`⚠️ Route not found or has errors: ${mount} (${error.message})`);
  }
});

// Create placeholder routes for missing functionality
app.get('/api/dashboard', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard endpoint - Coming soon',
    data: { status: 'under_development' }
  });
});

app.get('/api/voice', (req, res) => {
  res.json({
    success: true,
    message: 'Voice features endpoint - Coming soon', 
    data: { status: 'under_development' }
  });
});

app.get('/api/calls', (req, res) => {
  res.json({
    success: true,
    message: 'Voice/Video calls endpoint - Coming soon',
    data: { status: 'under_development' }
  });
});

app.get('/api/social', (req, res) => {
  res.json({
    success: true,
    message: 'Social media integration endpoint - Coming soon',
    data: { status: 'under_development' }
  });
});

app.get('/api/admin', (req, res) => {
  res.json({
    success: true,
    message: 'Admin panel endpoint - Coming soon',
    data: { status: 'under_development' }
  });
});

app.get('/api/media', (req, res) => {
  res.json({
    success: true,
    message: 'Media management endpoint - Coming soon',
    data: { status: 'under_development' }
  });
});

// Upload error handler (must come before other error handlers)
app.use(handleUploadError);

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

const PORT = process.env.PORT || 9001;

// Socket.io authentication and event handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    
    console.log(`🔌 Socket authenticated for user: ${socket.userId}`);
    next();
  } catch (error) {
    console.error('Socket authentication failed:', error.message);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.userId;
  console.log(`📱 User ${userId} connected with socket ${socket.id}`);
  
  // Join user to their personal room for real-time updates
  socket.join(`user_${userId}`);
  console.log(`🔔 User ${userId} joined personal room for real-time updates`);
  
  // Handle user connection (DISABLED)
  // chatService.handleUserConnection(socket, userId);

  // Setup WebRTC call handlers (DISABLED)
  // chatService.setupCallHandlers(socket);
  
  // Join user to their chat rooms
  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
    console.log(`📨 User ${userId} joined chat ${chatId}`);
  });
  
  // Handle typing indicators
  socket.on('typing', (data) => {
    console.log(`⌨️ SOCKET: User ${userId} ${data.isTyping ? 'started' : 'stopped'} typing in chat ${data.chatId}`);
    console.log(`📊 Socket rooms: ${Array.from(socket.rooms).join(', ')}`);
    
    // Broadcast typing status to other users in the chat (not including the sender)
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId: userId,
      isTyping: data.isTyping,
      status: data.isTyping ? 'typing' : 'online',
      timestamp: new Date()
    });
    
    // Also emit status change
    socket.to(`chat_${data.chatId}`).emit('user_status_change', {
      userId: userId,
      status: data.isTyping ? 'typing' : 'online',
      chatId: data.chatId,
      timestamp: new Date()
    });
    
    // Use the existing chat service (DISABLED)
    // chatService.handleTyping(data.chatId, userId, data.isTyping);
    
    console.log(`📡 Broadcasted typing status to chat_${data.chatId}: ${data.isTyping ? 'typing' : 'online'}`);
  });
  
  // Alternative typing event (in case frontend uses different event name)
  socket.on('user_typing', (data) => {
    console.log(`⌨️ ALT SOCKET: User ${userId} ${data.isTyping ? 'started' : 'stopped'} typing in chat ${data.chatId}`);
    
    socket.to(`chat_${data.chatId}`).emit('user_typing', {
      chatId: data.chatId,
      userId: userId,
      isTyping: data.isTyping,
      status: data.isTyping ? 'typing' : 'online',
      timestamp: new Date()
    });
  });
  
  // Handle recording status
  socket.on('recording', (data) => {
    console.log(`🎤 SOCKET: User ${userId} ${data.isRecording ? 'started' : 'stopped'} recording in chat ${data.chatId}`);
    console.log(`📊 Socket rooms: ${Array.from(socket.rooms).join(', ')}`);
    
    // Broadcast recording status to other users in the chat (not including the sender)
    socket.to(`chat_${data.chatId}`).emit('user_recording', {
      chatId: data.chatId,
      userId: userId,
      isRecording: data.isRecording,
      status: data.isRecording ? 'recording' : 'online',
      timestamp: new Date()
    });
    
    // Also emit status change
    socket.to(`chat_${data.chatId}`).emit('user_status_change', {
      userId: userId,
      status: data.isRecording ? 'recording' : 'online',
      chatId: data.chatId,
      timestamp: new Date()
    });
    
    // Use the existing chat service for recording (DISABLED)
    // chatService.handleRecording(data.chatId, userId, data.isRecording);
    
    console.log(`📡 Broadcasted recording status to chat_${data.chatId}: ${data.isRecording ? 'recording' : 'online'}`);
  });
  
  // Alternative recording event (in case frontend uses different event name)
  socket.on('user_recording', (data) => {
    console.log(`🎤 ALT SOCKET: User ${userId} ${data.isRecording ? 'started' : 'stopped'} recording in chat ${data.chatId}`);
    
    socket.to(`chat_${data.chatId}`).emit('user_recording', {
      chatId: data.chatId,
      userId: userId,
      isRecording: data.isRecording,
      status: data.isRecording ? 'recording' : 'online',
      timestamp: new Date()
    });
  });

  // Status-related real-time events
  socket.on('join_status_feed', () => {
    socket.join('status_feed');
    console.log(`📡 User ${userId} joined status feed for real-time updates`);
  });

  socket.on('leave_status_feed', () => {
    socket.leave('status_feed');
    console.log(`📡 User ${userId} left status feed`);
  });

  // Status engagement events
  socket.on('status_view', (data) => {
    // Increment view count for status
    socket.to(`user_${data.statusOwnerId}`).emit('status_viewed', {
      statusId: data.statusId,
      viewerId: userId,
      timestamp: new Date()
    });
  });

  socket.on('status_interaction', (data) => {
    // Broadcast status interactions (likes, comments) to status owner
    socket.to(`user_${data.statusOwnerId}`).emit('status_interaction', {
      statusId: data.statusId,
      type: data.type, // 'like', 'comment', 'share'
      userId: userId,
      data: data.data,
      timestamp: new Date()
    });
  });
  
  // Handle message read receipts
  socket.on('mark_read', async (data) => {
    try {
      await chatService.markMessagesAsRead(data.chatId, userId, data.messageIds);
    } catch (error) {
      console.error('Error marking messages as read via socket:', error);
      socket.emit('error', { message: 'Failed to mark messages as read' });
    }
  });
  
  // Legacy voice call events (keeping for backwards compatibility)
  socket.on('voice_call_offer', (data) => {
    socket.to(`chat_${data.chatId}`).emit('voice_call_offer', {
      ...data,
      callerId: userId
    });
  });
  
  socket.on('voice_call_answer', (data) => {
    socket.to(`chat_${data.chatId}`).emit('voice_call_answer', {
      ...data,
      answeredBy: userId
    });
  });
  
  socket.on('voice_call_end', (data) => {
    socket.to(`chat_${data.chatId}`).emit('voice_call_end', {
      ...data,
      endedBy: userId
    });
  });
  
  // Legacy ice candidates (keeping for backwards compatibility)
  socket.on('ice_candidate', (data) => {
    socket.to(`chat_${data.chatId}`).emit('ice_candidate', {
      ...data,
      from: userId
    });
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`📱 User ${userId} disconnected`);
    // chatService.handleUserDisconnection(socket, userId);
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB with timeout (for auth functionality)
    console.log('🔄 Connecting to MongoDB for auth functionality...');
    let mongoConnected = false;

    try {
      // Set a timeout for MongoDB connection attempt
      const mongoPromise = connectMongoDB();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 15000)
      );

      mongoConnected = await Promise.race([mongoPromise, timeoutPromise]);
    } catch (error) {
      console.warn('⚠️ MongoDB connection timed out or failed:', error.message);
      mongoConnected = false;
    }

    if (!mongoConnected) {
      console.warn('🚨 Server starting WITHOUT database (limited functionality)');
      console.warn('💡 To fix: ensure MongoDB is running or check connection string');
    } else {
      console.log('✅ MongoDB connected successfully');
    }
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Network: http://192.168.1.231:${PORT}/health`);
      console.log('📊 Database: MongoDB (localhost:27017)');
      console.log('⚡ Socket.io: Real-time messaging enabled');
      console.log('💬 Chat System: WhatsApp-like features enabled');
      
      // AI processing service disabled - using direct matching calls instead
      console.log('🤖 AI Matching Service: Direct API calls enabled (processing service disabled)');
    });

    // Handle port already in use error
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.log(`💡 Try one of these solutions:`);
        console.log(`   1. Kill the process using port ${PORT}`);
        console.log(`   2. Use a different port by setting PORT in your .env file`);
        process.exit(1);
      } else {
        throw error;
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Initialize cleanup service after server starts
const cleanupService = require('./services/cleanupService');

// Start cleanup service when server is ready
setTimeout(() => {
  cleanupService.start();
}, 5000); // Wait 5 seconds for server to be fully ready

// Add cleanup stats endpoint for monitoring
app.get('/api/admin/cleanup/stats', (req, res) => {
  const stats = cleanupService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

// Add manual cleanup trigger for admin use
app.post('/api/admin/cleanup/run', async (req, res) => {
  try {
    const stats = await cleanupService.runManualCleanup();
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Cleanup failed',
      error: error.message
    });
  }
});

module.exports = app;