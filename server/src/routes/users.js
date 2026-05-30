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

function genLogin() {
  const digits = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `nis@${digits}`;
}

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// Create a new student user (admin only)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    let { subjects, username, password } = req.body;

    // Auto-generate login if not provided
    if (!username) {
      let candidate;
      do {
        candidate = genLogin();
      } while (await User.findOne({ username: candidate }));
      username = candidate;
    } else {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    const generatedPassword = password || genPassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const user = new User({
      subjects: subjects || [],
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
        subjects: user.subjects,
        status: user.status
      },
      generatedPassword
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
    const { subjects, status, password } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (subjects !== undefined) user.subjects = subjects;
    if (status) user.status = status;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();

    res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        username: user.username,
        subjects: user.subjects,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a test result (admin only) — MUST be before /:id to avoid route conflict
router.delete('/results/:sessionId', authenticateAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId || sessionId.length !== 24) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    const session = await TestSession.findByIdAndDelete(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Test session not found' });
    }
    res.json({ message: 'Result deleted successfully' });
  } catch (error) {
    console.error('Delete result error:', error);
    res.status(500).json({ error: 'Failed to delete result' });
  }
});

// Delete a user (admin only) — cascade deletes all related data
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cascade: remove all test sessions and block logs
    const [sessions, logs] = await Promise.all([
      TestSession.deleteMany({ userId: id }),
      BlockLog.deleteMany({ userId: id }),
    ]);

    // If user is mid-test, kick them out via WebSocket + clean activeSessions
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      // Remove from in-memory active sessions
      const { activeSessions } = require('../routes/test');
      const session = activeSessions.get(id);
      if (session) {
        if (session.timeoutHandle) clearTimeout(session.timeoutHandle);
        activeSessions.delete(id);
      }
      // Send disconnect message to client
      wsServer.broadcast(id, {
        type: 'blocked',
        reason: 'admin_blocked',
        message: 'Hisobingiz o\'chirildi. Sahifani yoping.'
      });
    }

    res.json({
      message: 'User deleted successfully',
      deleted: {
        sessions: sessions.deletedCount,
        logs: logs.deletedCount
      }
    });
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

    const userIds = blockedUsers.map(u => u._id);

    // Get latest block log per user
    const blockLogs = await BlockLog.find({ userId: { $in: userIds } })
      .sort({ blockedAt: -1 });

    // Get completed subjects for each blocked user
    const completedSessions = await TestSession.find({
      userId: { $in: userIds },
      status: 'completed'
    }).populate('subjectId', 'name');

    const completedByUser = {};
    completedSessions.forEach(s => {
      const uid = s.userId.toString();
      if (!completedByUser[uid]) completedByUser[uid] = [];
      const name = s.subjectId?.name || 'Noma\'lum';
      if (!completedByUser[uid].includes(name)) completedByUser[uid].push(name);
    });

    const result = blockedUsers.map(user => {
      const uid = user._id.toString();
      const log = blockLogs.find(l => l.userId.toString() === uid);
      return {
        ...user.toObject(),
        blockReason: user.blockReason,
        blockedAt: user.blockedAt,
        blockDescription: log?.description || null,
        completedSubjects: completedByUser[uid] || []
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

    // Update block log (eng so'nggi yozuvni yangilash)
    const latestLog = await BlockLog.findOne({ userId: id, unblockedAt: null })
      .sort({ blockedAt: -1 });
    if (latestLog) {
      latestLog.unblockedAt = new Date();
      latestLog.unblockedBy = req.userId;
      await latestLog.save();
    }

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

    // Real-time WS notification to student if connected
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      wsServer.broadcast(id, {
        type: 'blocked',
        reason: reason || 'admin_blocked',
        message: 'Admin tomonidan bloklandingiz. Nazoratchi bilan bog\'laning.'
      });
    }

    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ── Barcha imtihon natijalari (admin) — filtrlar bilan ────────────────────
router.get('/results', authenticateAdmin, async (req, res) => {
  try {
    const { className, status } = req.query;

    let sessions = await TestSession.find({ status: 'completed' })
      .populate('userId',    'username firstName lastName className')
      .populate('subjectId', 'name passingThreshold')
      .sort({ completedAt: -1 });

    // Skip orphaned sessions (user was deleted)
    sessions = sessions.filter(s => s.userId != null);

    let rows = sessions.map(s => {
      const thr    = s.subjectId?.passingThreshold;
      const passed = thr?.thresholdType === 'count'
        ? (s.correctAnswers || 0) >= (thr?.thresholdValue ?? 60)
        : (s.score         || 0) >= (thr?.thresholdValue ?? 60);
      return {
        id:             s._id,
        student:        s.userId,
        subject:        s.subjectId?.name || '—',
        score:          s.score,
        correctAnswers: s.correctAnswers,
        wrongAnswers:   s.wrongAnswers,
        totalQuestions: s.totalQuestions,
        passed,
        completedAt:    s.completedAt || s.endTime
      };
    });

    if (className) {
      const q = className.toLowerCase();
      rows = rows.filter(r => (r.student?.className || '').toLowerCase().includes(q));
    }
    if (status === 'passed') rows = rows.filter(r =>  r.passed);
    if (status === 'failed') rows = rows.filter(r => !r.passed);

    res.json(rows);
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
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
