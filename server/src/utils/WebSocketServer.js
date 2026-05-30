const WebSocket = require('ws');
const User = require('../models/User');
const BlockLog = require('../models/BlockLog');
const TestSession = require('../models/TestSession');
const { activeSessions, submitTest, handleTestTimeout } = require('../routes/test');

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_TIMEOUT = 30000; // 30 seconds - if no heartbeat, block user

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map();      // Map<userId, WebSocket>  — students
    this.adminClients = new Set(); // Set<WebSocket>          — admins
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Check for inactive sessions periodically
    setInterval(() => this.checkHeartbeats(), HEARTBEAT_INTERVAL);
    
    console.log('WebSocket server initialized');
  }

  handleConnection(ws, req) {
    console.log('New WebSocket connection');

    ws.isAlive = true;
    ws.userId = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            // Authenticate the WebSocket connection
            await this.handleAuth(ws, message);
            break;
            
          case 'heartbeat':
            // Handle heartbeat from client
            await this.handleHeartbeat(ws, message);
            break;
            
          case 'keypress':
            // Handle key press tracking
            await this.handleKeyPress(ws, message);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (ws.isAdmin) {
        this.adminClients.delete(ws);
      } else if (ws.userId) {
        this.clients.delete(ws.userId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  async handleAuth(ws, message) {
    const { userId, token, role } = message;

    if (role === 'admin') {
      ws.isAdmin = true;
      this.adminClients.add(ws);
      ws.send(JSON.stringify({ type: 'auth_success', message: 'Admin WebSocket connected' }));
      console.log('Admin WebSocket connected');
      return;
    }

    ws.userId = userId;
    this.clients.set(userId, ws);
    ws.send(JSON.stringify({ type: 'auth_success', message: 'WebSocket authenticated' }));
    console.log(`WebSocket authenticated for user: ${userId}`);
  }

  // Admin panelga real-vaqtda xabar yuborish
  broadcastAdmins(message) {
    const data = JSON.stringify(message);
    this.adminClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
  }

  async handleHeartbeat(ws, message) {
    if (!ws.userId) return;

    ws.isAlive = true;
    
    // Update session heartbeat
    const session = activeSessions.get(ws.userId);
    if (session) {
      session.lastHeartbeat = Date.now();
      
      ws.send(JSON.stringify({
        type: 'heartbeat_ack',
        remainingTime: session.totalTimeLimit - (Date.now() - session.startTime)
      }));
    }
  }

  async handleKeyPress(ws, message) {
    if (!ws.userId) return;

    // Faqat aktiv test sessiyasi bo'lganda hisoblash
    if (!activeSessions.has(ws.userId.toString())) return;

    const user = await User.findById(ws.userId);
    if (!user || user.status === 'blocked') return;

    // Increment key press count
    user.keyPressCount = (user.keyPressCount || 0) + 1;
    
    // Check if exceeded limit (3 presses)
    if (user.keyPressCount > 3) {
      await this.blockUserForExcessiveKeys(ws.userId);
      
      ws.send(JSON.stringify({
        type: 'blocked',
        reason: 'excessive_keys',
        message: 'Siz klaviaturadan ko\'p foydalandingiz va bloklandingiz. Adminga murojaat qiling'
      }));
      
      return;
    }
    
    await user.save();
    
    ws.send(JSON.stringify({
      type: 'keypress_ack',
      count: user.keyPressCount,
      remaining: 3 - user.keyPressCount
    }));
  }

  async blockUserForExcessiveKeys(userId) {
    try {
      // Update user status
      await User.findByIdAndUpdate(userId, {
        status: 'blocked',
        blockReason: 'excessive_keys',
        blockedAt: new Date()
      });

      // Create block log
      await BlockLog.create({
        userId,
        reason: 'excessive_keys',
        description: 'User pressed allowed keys more than 3 times during test'
      });

      // Mark any active test session as interrupted
      await TestSession.updateMany(
        { userId, status: 'active' },
        { status: 'interrupted' }
      );

      // Remove from active sessions
      const session = activeSessions.get(userId.toString());
      if (session && session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
      activeSessions.delete(userId.toString());

      console.log(`User ${userId} blocked for excessive key presses`);
    } catch (error) {
      console.error('Block user error:', error);
    }
  }

  checkHeartbeats() {
    // Check all WebSocket connections
    this.wss.clients.forEach(async (ws) => {
      if (!ws.isAlive) {
        // Connection is dead
        if (ws.userId) {
          await this.handleDisconnect(ws.userId, 'websocket_lost');
        }
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });

    // Also check HTTP-based sessions (for clients not using WebSocket)
    activeSessions.forEach(async (session, userId) => {
      const timeSinceHeartbeat = Date.now() - session.lastHeartbeat;
      
      if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
        await this.handleDisconnect(userId, 'heartbeat_timeout');
      }
    });
  }

  async handleDisconnect(userId, reason) {
    try {
      console.log(`Handling disconnect for user ${userId}, reason: ${reason}`);
      
      // Get user
      const user = await User.findById(userId);
      if (!user || user.status === 'blocked') return;

      // Block the user
      await User.findByIdAndUpdate(userId, {
        status: 'blocked',
        blockReason: reason === 'websocket_lost' ? 'internet_lost' : 'test_interrupted',
        blockedAt: new Date()
      });

      // Create block log
      await BlockLog.create({
        userId,
        reason: reason === 'websocket_lost' ? 'internet_lost' : 'test_interrupted',
        description: reason === 'websocket_lost' 
          ? 'WebSocket connection lost - possible internet disconnection'
          : 'No heartbeat received for 30 seconds - test interrupted'
      });

      // Mark test session as interrupted
      await TestSession.updateMany(
        { userId, status: 'active' },
        { status: 'interrupted' }
      );

      // Remove from active sessions
      const session = activeSessions.get(userId);
      if (session && session.timeoutHandle) {
        clearTimeout(session.timeoutHandle);
      }
      activeSessions.delete(userId);

      console.log(`User ${userId} blocked due to ${reason}`);
    } catch (error) {
      console.error('Handle disconnect error:', error);
    }
  }

  broadcast(userId, message) {
    const ws = this.clients.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

module.exports = WebSocketServer;
