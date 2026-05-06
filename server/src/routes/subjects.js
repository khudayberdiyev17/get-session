const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const TestSession = require('../models/TestSession');
const { authenticateStudent, authenticateAdmin } = require('../middleware/auth');
const { subjectFetchLimiter } = require('../middleware/rateLimiter');

// Get all available subjects (for students)
router.get('/', authenticateStudent, subjectFetchLimiter, async (req, res) => {
  try {
    const user = req.user;
    
    // Find subjects that match the user's subjectName or all active subjects
    const subjects = await Subject.find({ 
      isActive: true,
      $or: [
        { name: user.subjectName },
        { name: new RegExp(user.subjectName, 'i') }
      ]
    }).select('name description totalTimeLimit isActive');

    // Check which subjects the user has already completed
    const completedSessions = await TestSession.find({
      userId: user._id,
      status: 'completed'
    }).select('subjectId score correctAnswers totalQuestions completedAt');

    const completedSubjectIds = completedSessions.map(s => s.subjectId.toString());
    const completedSubjectsMap = {};
    completedSessions.forEach(s => {
      completedSubjectsMap[s.subjectId.toString()] = s;
    });

    const result = subjects.map(subject => {
      const subjectId = subject._id.toString();
      return {
        id: subjectId,
        name: subject.name,
        description: subject.description,
        totalTimeLimit: subject.totalTimeLimit,
        isCompleted: completedSubjectIds.includes(subjectId),
        completedData: completedSubjectsMap[subjectId] || null
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Get subjects for admin panel
router.get('/admin', authenticateAdmin, async (req, res) => {
  try {
    const subjects = await Subject.find({}).sort({ createdAt: -1 });
    res.json(subjects);
  } catch (error) {
    console.error('Get subjects admin error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create a new subject (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, totalTimeLimit, questions } = req.body;

    if (!name || !totalTimeLimit) {
      return res.status(400).json({ error: 'Name and totalTimeLimit are required' });
    }

    // Validate questions if provided
    if (questions && questions.length > 0) {
      for (const q of questions) {
        if (!q.text || !q.options || q.options.length !== 4 || q.correctIndex === undefined) {
          return res.status(400).json({ error: 'Invalid question format' });
        }
      }
    }

    const subject = new Subject({
      name,
      description: description || '',
      totalTimeLimit,
      questions: questions || []
    });

    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    console.error('Create subject error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Subject name already exists' });
    }
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// Update a subject (admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, totalTimeLimit, questions, isActive } = req.body;

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (name) subject.name = name;
    if (description !== undefined) subject.description = description;
    if (totalTimeLimit) subject.totalTimeLimit = totalTimeLimit;
    if (questions) subject.questions = questions;
    if (isActive !== undefined) subject.isActive = isActive;

    await subject.save();
    res.json(subject);
  } catch (error) {
    console.error('Update subject error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Subject name already exists' });
    }
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Delete a subject (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const subject = await Subject.findByIdAndDelete(id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// Add a question to a subject (admin only)
router.post('/:id/questions', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, options, correctIndex, timeLimit } = req.body;

    if (!text || !options || options.length !== 4 || correctIndex === undefined) {
      return res.status(400).json({ error: 'Invalid question data' });
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    const question = {
      text,
      options,
      correctIndex,
      timeLimit: timeLimit || 60
    };

    subject.questions.push(question);
    await subject.save();

    res.status(201).json(subject);
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

module.exports = router;
