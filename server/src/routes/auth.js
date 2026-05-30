const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken, authenticateStudent } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// Login endpoint for students
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // NoSQL injection himoyasi — faqat string qabul qilinadi
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Invalid input format' });
    }

    const user = await User.findOne({ username: username.trim() });
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
        subjects: user.subjects || []
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
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      className: user.className,
      subjects: user.subjects || [],
      status: user.status,
      blockReason: user.blockReason || null,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Update student's own profile (name/surname/class — student fills these in)
router.put('/profile', authenticateStudent, async (req, res) => {
  try {
    const { firstName, lastName, className } = req.body;
    const user = req.user;

    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (className !== undefined) user.className = className.trim();

    await user.save();

    res.json({
      message: 'Profile updated',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        className: user.className,
        subjects: user.subjects || []
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
