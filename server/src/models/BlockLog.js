const mongoose = require('mongoose');

const blockLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { 
    type: String, 
    required: true,
    enum: [
      'excessive_keys',
      'internet_lost',
      'pc_shutdown',
      'admin_blocked',
      'rate_limit_exceeded',
      'test_interrupted'
    ]
  },
  description: { type: String, required: true },
  blockedAt: { type: Date, default: Date.now },
  unblockedAt: { type: Date, default: null },
  unblockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
});

module.exports = mongoose.model('BlockLog', blockLogSchema);
