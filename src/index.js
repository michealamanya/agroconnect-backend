const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Firebase (must be before routes)
require('./config/firebase');

// Connect to MongoDB
const { connectMongoDB } = require('./config/mongodb');
connectMongoDB();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/produce', require('./routes/produceRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/images', require('./routes/imageRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AgroConnect API',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server (bind to 0.0.0.0 for cloud deployment)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌱 AgroConnect API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health\n`);
  console.log('Available endpoints:');
  console.log('  Users:         /api/users');
  console.log('  Produce:       /api/produce');
  console.log('  Chat:          /api/chat');
  console.log('  Notifications: /api/notifications');
  console.log('  Images:        /api/images');
  console.log('');
});
