const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, authenticateStudent } = require('../middleware/auth');

// Login endpoint for students
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is blocked
    if (user.status === 'blocked') {
      let message = 'Siz klaviaturadan ko\'p foydalandingiz va bloklandingiz. Adminga murojaat qiling';
      if (user.blockReason === 'internet_lost') {
        message = 'Test interrupted – internet lost or PC powered off.';
      } else if (user.blockReason === 'admin_blocked') {
        message = 'Admin has blocked your account.';
      } else if (user.blockReason === 'rate_limit_exceeded') {
        message = 'Too many requests. Contact admin.';
      }
      
      return res.status(403).json({ 
        error: 'User is blocked',
        blockReason: user.blockReason,
        message: message
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id, 'student');

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        className: user.className,
        subjectName: user.subjectName
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user info
router.get('/me', authenticateStudent, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      className: user.className,
      subjectName: user.subjectName,
      status: user.status,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;
