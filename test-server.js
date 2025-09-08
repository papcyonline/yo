const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { connectMongoDB } = require('./config/mongodb');

const app = express();
const PORT = process.env.PORT || 3020;

// Basic CORS setup for testing
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add auth middleware
const auth = require('./middleware/auth');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server running' });
});

// Debug auth endpoint
app.get('/debug-auth', auth, (req, res) => {
  res.json({ 
    status: 'authenticated', 
    user: req.user?._id,
    message: 'Authentication working' 
  });
});

// Add genealogy routes
app.use('/api/genealogy', require('./routes/genealogy'));

// Basic auth route for testing
app.use('/api/auth', require('./routes/auth/mongodb'));

// Error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

async function startServer() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const mongoConnected = await connectMongoDB();
    
    if (!mongoConnected) {
      console.error('❌ MongoDB connection failed.');
      process.exit(1);
    }
    
    console.log('✅ MongoDB connected successfully');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Test server running on port ${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🧬 Genealogy API: http://localhost:${PORT}/api/genealogy`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
}

startServer();