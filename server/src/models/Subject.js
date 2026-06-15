const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  timeLimit: { type: Number, required: true, default: 60 },
  imageBase64: { type: String, default: null }
});

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  totalTimeLimit: { type: Number, required: true }, // Total time in minutes for the whole test
  passingThreshold: {
    thresholdType:  { type: String, enum: ['percent', 'count'], default: 'percent' },
    thresholdValue: { type: Number, default: 60 }
  },
  questions: [questionSchema],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subjectSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Subject', subjectSchema);
