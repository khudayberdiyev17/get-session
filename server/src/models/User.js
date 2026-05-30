const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  className: { type: String, default: '' },
  subjects: { type: [String], default: [] },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  blockReason: { type: String, default: null },
  blockedAt: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
  keyPressCount: { type: Number, default: 0 }, // Track allowed key presses during test
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('User', userSchema);
