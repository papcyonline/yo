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

// MongoDB-only database connection
const { connectMongoDB, testMongoConnection } = require('./config/mongodb');

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

// Initialize Chat Service
const chatService = new ChatService(io);
app.locals.chatService = chatService;

// Connect Socket.io to Enhanced Matching Service for real-time updates
const { enhancedMatchingService } = require('./services/aiMatchingService');
enhancedMatchingService.setSocketIO(io);

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

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads (images, documents, etc.)
app.use('/uploads', express.static('uploads'));

// Rate limiting
app.use('/api/', rateLimit.general);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// MongoDB-only routes (temporarily minimal for testing)
console.log('📡 Using MongoDB routes exclusively - MINIMAL MODE');
app.use('/api/auth', require('./routes/auth/mongodb'));
app.use('/api/users', require('./routes/users-router')); // User profile endpoints
app.use('/api/status', require('./routes/status')); // Status/Posts feature
app.use('/api/settings', require('./routes/settings-router')); // Settings & Legal pages
app.use('/api/notifications', require('./routes/notifications-router')); // Notifications
app.use('/api/friends', require('./routes/friends-router')); // Friends management
app.use('/api/chats', require('./routes/chats-router')); // Chat endpoints
app.use('/api/unified-onboarding', require('./routes/unified-onboarding')); // Unified onboarding endpoints
app.use('/api/matching', require('./routes/matching-router')); // Matching endpoints
app.use('/api/ai', require('./routes/ai-router')); // AI endpoints
app.use('/api/communities', require('./routes/communities-router')); // Communities

// TODO: Re-enable other routes after fixing them
app.use('/api/safety', require('./routes/safety'));
// app.use('/api/communities', require('./routes/communities'));
// app.use('/api/chats', require('./routes/chats_v2'));
// app.use('/api/notifications', require('./routes/notifications-mongodb'));
// app.use('/api/settings', require('./routes/settings'));
// app.use('/api/ai', require('./routes/ai'));
// app.use('/api/dashboard', require('./routes/dashboard'));
// app.use('/api/voice', require('./routes/voice'));
// app.use('/api/calls', require('./routes/calls'));
// app.use('/api/social', require('./routes/social'));
// app.use('/api/admin', require('./routes/admin'));
// app.use('/api/media', require('./routes/media'));
// app.use('/api/media', require('./routes/media-download'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
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
  
  // Handle user connection
  chatService.handleUserConnection(socket, userId);
  
  // Setup WebRTC call handlers
  chatService.setupCallHandlers(socket);
  
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
    
    // Use the existing chat service
    chatService.handleTyping(data.chatId, userId, data.isTyping);
    
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
    
    // Use the existing chat service for recording
    chatService.handleRecording(data.chatId, userId, data.isRecording);
    
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
    chatService.handleUserDisconnection(socket, userId);
  });
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB exclusively
    console.log('🔄 Connecting to MongoDB...');
    const mongoConnected = await connectMongoDB();
    
    if (!mongoConnected) {
      console.error('❌ MongoDB connection failed. Server cannot start without database.');
      process.exit(1);
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

startServer();

module.exports = app;