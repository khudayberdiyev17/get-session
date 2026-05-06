const rateLimit = require('express-rate-limit');

// Rate limiter for student endpoints (30 requests per minute per IP)
const studentRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for subject fetch requests (5 requests per 10 seconds per user)
const subjectFetchLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5,
  message: { 
    error: 'Too many subject fetch requests. You have been temporarily blocked.',
    code: 'RATE_LIMIT_SUBJECT'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
  handler: async (req, res) => {
    // Auto-block user for excessive requests
    if (req.userId) {
      const User = require('../models/User');
      const BlockLog = require('../models/BlockLog');
      
      await User.findByIdAndUpdate(req.userId, {
        status: 'blocked',
        blockReason: 'rate_limit_exceeded',
        blockedAt: new Date()
      });
      
      await BlockLog.create({
        userId: req.userId,
        reason: 'rate_limit_exceeded',
        description: 'Excessive subject fetch requests (>5 in 10 seconds)'
      });
    }
    res.status(429).json({ 
      error: 'Too many subject fetch requests. You have been blocked.',
      code: 'RATE_LIMIT_SUBJECT'
    });
  }
});

// Rate limiter for admin endpoints (10 requests per second per user)
const adminRateLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10,
  message: { error: 'Too many admin requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId || req.ip,
});

// General API rate limiter
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  studentRateLimiter,
  subjectFetchLimiter,
  adminRateLimiter,
  apiRateLimiter
};
