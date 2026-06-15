const express = require('express');
const router = express.Router();

// Simple ping endpoint for internet speed check
router.get('/', (req, res) => {
  res.json({ 
    timestamp: Date.now(),
    message: 'pong'
  });
});

module.exports = router;
