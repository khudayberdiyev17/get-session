const express = require('express');
const router = express.Router();
const User = require('../models/User');
const BlockLog = require('../models/BlockLog');
const TestSession = require('../models/TestSession');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authenticateAdmin, generateToken } = require('../middleware/auth');

// Get all users (admin only)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: 'student' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a new student user (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { firstName, lastName, className, subjectName, username, password } = req.body;

    if (!firstName || !lastName || !className || !subjectName || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Generate password if not provided
    const generatedPassword = password || uuidv4().substring(0, 8).toUpperCase();
    
    // Hash password
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const user = new User({
      firstName,
      lastName,
      className,
      subjectName,
      username,
      password: hashedPassword,
      role: 'student',
      status: 'active'
    });

    await user.save();

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        className: user.className,
        subjectName: user.subjectName,
        status: user.status
      },
      generatedPassword // Show the password once on creation
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update a user (admin only)
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, className, subjectName, status, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (className) user.className = className;
    if (subjectName) user.subjectName = subjectName;
    if (status) user.status = status;
    
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        className: user.className,
        subjectName: user.subjectName,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user (admin only)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get blocked users (admin only)
router.get('/blocked', authenticateAdmin, async (req, res) => {
  try {
    const blockedUsers = await User.find({ status: 'blocked', role: 'student' })
      .select('-password')
      .sort({ blockedAt: -1 });
    
    // Get block logs for additional info
    const userIds = blockedUsers.map(u => u._id);
    const blockLogs = await BlockLog.find({ userId: { $in: userIds } })
      .sort({ blockedAt: -1 })
      .limit(blockedUsers.length);

    const result = blockedUsers.map(user => {
      const log = blockLogs.find(l => l.userId.toString() === user._id.toString());
      return {
        ...user.toObject(),
        blockReason: user.blockReason,
        blockedAt: user.blockedAt,
        blockDescription: log?.description || null
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Unblock a user (admin only)
router.put('/:id/unblock', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.status = 'active';
    user.blockReason = null;
    user.blockedAt = null;
    user.keyPressCount = 0; // Reset key press count
    await user.save();

    // Update block log
    await BlockLog.updateOne(
      { userId: id, unblockedAt: null },
      { 
        unblockedAt: new Date(),
        unblockedBy: req.userId
      },
      { sort: { blockedAt: -1 } }
    );

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Manually block a user (admin only)
router.put('/:id/block', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.status = 'blocked';
    user.blockReason = reason || 'admin_blocked';
    user.blockedAt = new Date();
    await user.save();

    // Create block log
    await BlockLog.create({
      userId: id,
      reason: reason || 'admin_blocked',
      description: description || 'Manually blocked by admin',
      unblockedBy: req.userId
    });

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Get user test history (admin only)
router.get('/:id/history', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const sessions = await TestSession.find({ userId: id })
      .populate('subjectId', 'name')
      .sort({ completedAt: -1 });

    res.json(sessions);
  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

// Get detailed test report (admin only)
router.get('/reports/:sessionId', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await TestSession.findById(sessionId)
      .populate('userId', 'firstName lastName username className')
      .populate('subjectId');

    if (!session) {
      return res.status(404).json({ error: 'Test session not found' });
    }

    // Build detailed results
    const subject = session.subjectId;
    const detailedResults = session.answers.map(answer => {
      const question = subject.questions[answer.questionIndex];
      const isCorrect = answer.selectedOption === question.correctIndex;
      return {
        questionIndex: answer.questionIndex,
        questionText: question.text,
        selectedOption: answer.selectedOption,
        selectedOptionText: question.options[answer.selectedOption],
        correctOption: question.correctIndex,
        correctOptionText: question.options[question.correctIndex],
        isCorrect
      };
    });

    res.json({
      session: {
        id: session._id,
        student: session.userId,
        subject: subject.name,
        score: session.score,
        totalQuestions: session.totalQuestions,
        correctAnswers: session.correctAnswers,
        wrongAnswers: session.wrongAnswers,
        startTime: session.startTime,
        endTime: session.endTime,
        timeUsed: session.timeUsed,
        status: session.status
      },
      detailedResults
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

module.exports = router;
