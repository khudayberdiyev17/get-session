const mongoose = require('mongoose');

const testSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  status: { 
    type: String, 
    enum: ['active', 'completed', 'interrupted'], 
    default: 'active' 
  },
  answers: [{
    questionIndex: { type: Number, required: true },
    selectedOption: { type: Number, required: true } // Index of selected option (0-3)
  }],
  score: { type: Number, default: 0 },
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, default: 0 },
  wrongAnswers: { type: Number, default: 0 },
  startTime: { type: Date, required: true, default: Date.now },
  endTime: { type: Date, default: null },
  timeUsed: { type: Number, default: 0 }, // Time used in seconds
  completedAt: { type: Date, default: null }
});

testSessionSchema.pre('save', function(next) {
  if (this.status === 'completed') {
    this.endTime = new Date();
    this.completedAt = new Date();
    this.timeUsed = Math.floor((this.endTime - this.startTime) / 1000);
  }
  next();
});

module.exports = mongoose.model('TestSession', testSessionSchema);
