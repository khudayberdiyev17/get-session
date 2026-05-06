require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const subjectRoutes = require('./routes/subjects');
const testRoutes = require('./routes/test');
const userRoutes = require('./routes/users');
const pingRoutes = require('./routes/ping');

// Import middleware
const { apiRateLimiter } = require('./middleware/rateLimiter');

// Import WebSocket server
const WebSocketServer = require('./utils/WebSocketServer');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/exam-system';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Configure appropriately for production
  credentials: true
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', apiRateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/test', testRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ping', pingRoutes);

// Admin login route (for admin panel authentication)
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    const { generateToken } = require('./middleware/auth');

    const user = await User.findOne({ username, role: 'admin' });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Admin account is blocked' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user._id, 'admin', '7d');

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Connect to MongoDB and start server
async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api`);
      console.log(`WebSocket available at ws://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
