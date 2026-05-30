const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const TestSession = require('../models/TestSession');
const User = require('../models/User');
const { authenticateStudent } = require('../middleware/auth');

// Global map to track active test sessions (in-memory for real-time tracking)
// Key: userId, Value: { subjectId, startTime, lastHeartbeat, timeoutHandle }
const activeSessions = new Map();

// Start a new test session - get questions for a subject
router.get('/questions', authenticateStudent, async (req, res) => {
  try {
    const { subjectId } = req.query;
    const userId = req.userId.toString();

    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }

    // Check if user already has an active test session
    if (activeSessions.has(userId)) {
      const existingSession = activeSessions.get(userId);
      return res.status(409).json({ 
        error: 'Test already in progress',
        message: 'You must finish or submit your current test before starting a new one.',
        existingSubjectId: existingSession.subjectId
      });
    }

    // Check if there's an unfinished session in DB
    const unfinishedSession = await TestSession.findOne({
      userId: req.userId,
      status: 'active'
    });

    if (unfinishedSession) {
      return res.status(409).json({ 
        error: 'Unfinished test session exists',
        message: 'You have an unfinished test. Please complete it first.'
      });
    }

    // Get the subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    if (!subject.isActive) {
      return res.status(403).json({ error: 'This subject is currently inactive' });
    }

    // Check if user already completed this subject
    const completedSession = await TestSession.findOne({
      userId: req.userId,
      subjectId,
      status: 'completed'
    });

    if (completedSession) {
      return res.status(403).json({ 
        error: 'Subject already completed',
        message: 'You have already completed this subject.'
      });
    }

    // Reset key press count so this test starts fresh
    await User.findByIdAndUpdate(req.userId, { keyPressCount: 0 });

    // Create a new test session in DB
    const testSession = new TestSession({
      userId: req.userId,
      subjectId: subject._id,
      totalQuestions: subject.questions.length,
      status: 'active'
    });
    await testSession.save();

    // Store active session in memory
    const sessionData = {
      subjectId: subject._id.toString(),
      testSessionId: testSession._id.toString(),
      startTime: Date.now(),
      lastHeartbeat: Date.now(),
      totalTimeLimit: subject.totalTimeLimit * 60 * 1000, // Convert minutes to ms
      questions: subject.questions.map((q, index) => ({
        index,
        text: q.text,
        options: q.options,
        timeLimit: q.timeLimit
      }))
    };

    activeSessions.set(userId, sessionData);

    // Set up auto-timeout
    const timeoutHandle = setTimeout(async () => {
      await handleTestTimeout(userId);
    }, sessionData.totalTimeLimit);

    activeSessions.get(userId).timeoutHandle = timeoutHandle;

    // Return questions WITHOUT correct answers
    res.json({
      sessionId: testSession._id,
      subjectId: subject._id,
      subjectName: subject.name,
      totalTimeLimit: subject.totalTimeLimit, // in minutes
      passingThreshold: subject.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 },
      questions: sessionData.questions,
      startTime: sessionData.startTime
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Handle test timeout
async function handleTestTimeout(userId) {
  try {
    const session = activeSessions.get(userId);
    if (!session) return;

    // Auto-submit with current answers
    await submitTest(userId, 'timeout');
  } catch (error) {
    console.error('Timeout handler error:', error);
  }
}

// Submit test answers
router.post('/submit', authenticateStudent, async (req, res) => {
  try {
    const { answers } = req.body;
    const userId = req.userId.toString();

    const session = activeSessions.get(userId);
    if (!session) {
      return res.status(400).json({ error: 'No active test session found' });
    }

    // Validate answers
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Answers are required' });
    }

    const result = await submitTest(userId, 'manual', answers);
    activeSessions.delete(userId);

    // Adminga real-vaqtda xabar
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      const u = req.user;
      wsServer.broadcastAdmins({
        type: 'test_completed',
        student: {
          id: u._id,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          className: u.className
        },
        score:          result.score,
        correctAnswers: result.correctAnswers,
        wrongAnswers:   result.wrongAnswers,
        totalQuestions: result.totalQuestions,
        passed:         result.passed,
        completedAt:    new Date().toISOString()
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Submit test error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// Submit test helper function
async function submitTest(userId, reason, answers = []) {
  const session = activeSessions.get(userId);
  if (!session) throw new Error('No active session');

  const subject = await Subject.findById(session.subjectId);
  if (!subject) throw new Error('Subject not found');

  // Calculate score
  let correctAnswers = 0;
  let wrongAnswers = 0;
  const detailedResults = [];

  for (const answer of answers) {
    const question = subject.questions[answer.questionIndex];
    if (!question) continue;

    const isCorrect = answer.selectedOption === question.correctIndex;
    if (isCorrect) {
      correctAnswers++;
    } else {
      wrongAnswers++;
    }

    detailedResults.push({
      questionIndex: answer.questionIndex,
      questionText: question.text,
      selectedOption: answer.selectedOption,
      selectedOptionText: question.options[answer.selectedOption],
      correctOption: question.correctIndex,
      correctOptionText: question.options[question.correctIndex],
      isCorrect
    });
  }

  // Handle unanswered questions as wrong
  const answeredIndices = answers.map(a => a.questionIndex);
  for (let i = 0; i < subject.questions.length; i++) {
    if (!answeredIndices.includes(i)) {
      wrongAnswers++;
      const question = subject.questions[i];
      detailedResults.push({
        questionIndex: i,
        questionText: question.text,
        selectedOption: null,
        selectedOptionText: null,
        correctOption: question.correctIndex,
        correctOptionText: question.options[question.correctIndex],
        isCorrect: false,
        reason: 'unanswered'
      });
    }
  }

  const score = Math.round((correctAnswers / subject.questions.length) * 100);

  // Compute passed using subject's threshold (default 60%)
  const thr = subject.passingThreshold;
  const passed = thr?.thresholdType === 'count'
    ? correctAnswers >= (thr?.thresholdValue ?? 60)
    : score        >= (thr?.thresholdValue ?? 60);

  // Update test session in DB
  const testSession = await TestSession.findOne({
    userId,
    subjectId: session.subjectId,
    status: 'active'
  });

  if (testSession) {
    testSession.answers = answers;
    testSession.score = score;
    testSession.correctAnswers = correctAnswers;
    testSession.wrongAnswers = wrongAnswers;
    testSession.status = 'completed';
    await testSession.save();
  }

  // Clear timeout
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }

  return {
    message: reason === 'timeout' ? 'Test submitted due to timeout' : 'Test submitted successfully',
    score,
    passed,
    passingThreshold: subject.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 },
    totalQuestions: subject.questions.length,
    correctAnswers,
    wrongAnswers,
    timeUsed: Math.floor((Date.now() - session.startTime) / 1000),
    detailedResults
  };
}

// Heartbeat endpoint for WebSocket alternative (HTTP-based keep-alive)
router.post('/heartbeat', authenticateStudent, async (req, res) => {
  try {
    const userId = req.userId.toString();
    const session = activeSessions.get(userId);

    if (!session) {
      return res.status(400).json({ 
        error: 'No active test session',
        shouldReturnToLogin: true
      });
    }

    // Update last heartbeat
    session.lastHeartbeat = Date.now();

    res.json({
      success: true,
      remainingTime: session.totalTimeLimit - (Date.now() - session.startTime)
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// Get active session status
router.get('/status', authenticateStudent, async (req, res) => {
  try {
    const userId = req.userId.toString();
    const session = activeSessions.get(userId);

    if (!session) {
      return res.json({ hasActiveSession: false });
    }

    res.json({
      hasActiveSession: true,
      subjectId: session.subjectId,
      remainingTime: session.totalTimeLimit - (Date.now() - session.startTime),
      startTime: session.startTime
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// Report test interruption (for client to notify server of disconnect/shutdown)
router.post('/report-interruption', authenticateStudent, async (req, res) => {
  try {
    const userId = req.userId;
    const { reason, description } = req.body;

    const session = activeSessions.get(userId.toString());

    // Faqat aktiv sessiyasi bo'lgan foydalanuvchini bloklash mumkin
    // (aktivsiz holda bu endpointni chaqirish mantiqiy xato / suiste'mol)
    const dbSession = await TestSession.findOne({ userId, status: 'active' });
    if (!session && !dbSession) {
      return res.status(400).json({ error: 'No active test session to interrupt' });
    }

    if (session) {
      // Clear timeout
      if (session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
      activeSessions.delete(userId.toString());
    }

    // Mark user as blocked
    await User.findByIdAndUpdate(userId, {
      status: 'blocked',
      blockReason: reason || 'test_interrupted',
      blockedAt: new Date()
    });

    // Log the block
    const BlockLog = require('../models/BlockLog');
    await BlockLog.create({
      userId,
      reason: reason || 'test_interrupted',
      description: description || 'Test interrupted - internet lost or PC powered off'
    });

    // Mark any active test session as interrupted
    await TestSession.updateMany(
      { userId, status: 'active' },
      { status: 'interrupted' }
    );

    res.json({ message: 'Interruption reported, user blocked' });
  } catch (error) {
    console.error('Report interruption error:', error);
    res.status(500).json({ error: 'Failed to report interruption' });
  }
});

// Attach helpers to router so WebSocketServer can destructure them
router.activeSessions      = activeSessions;
router.submitTest          = submitTest;
router.handleTestTimeout   = handleTestTimeout;

module.exports = router;
