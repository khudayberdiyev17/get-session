# Exam System Backend Server

## Overview
This is the backend server for the Exam/Quiz System. It provides REST API endpoints and WebSocket support for real-time communication with the C++ client application and admin panel.

## Prerequisites
- Node.js 18 or later
- MongoDB 6 or later (or MongoDB Atlas)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` file with your configuration:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/exam-system
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h
ADMIN_JWT_EXPIRES_IN=7d
```

4. Seed the database with initial data:
```bash
npm run seed
```

5. Start the server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Default Credentials (after seeding)

**Admin:**
- Username: `admin`
- Password: `admin123`

**Students:**
- Username: `student1` to `student5`
- Password: `password123`

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/login` | Student login | No |
| GET | `/api/auth/me` | Get current user info | Yes (Student) |
| POST | `/api/admin/login` | Admin login | No |

### Subjects
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/subjects` | Get available subjects | Yes (Student) |
| GET | `/api/subjects/admin` | Get all subjects | Yes (Admin) |
| POST | `/api/subjects` | Create subject | Yes (Admin) |
| PUT | `/api/subjects/:id` | Update subject | Yes (Admin) |
| DELETE | `/api/subjects/:id` | Delete subject | Yes (Admin) |
| POST | `/api/subjects/:id/questions` | Add question | Yes (Admin) |

### Test
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/test/questions?subjectId=xxx` | Start test, get questions | Yes (Student) |
| POST | `/api/test/submit` | Submit answers | Yes (Student) |
| POST | `/api/test/heartbeat` | Send heartbeat | Yes (Student) |
| GET | `/api/test/status` | Check active session | Yes (Student) |
| POST | `/api/test/report-interruption` | Report disconnect | Yes (Student) |

### Users (Admin)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | Get all students | Yes (Admin) |
| POST | `/api/users` | Create student | Yes (Admin) |
| PUT | `/api/users/:id` | Update student | Yes (Admin) |
| DELETE | `/api/users/:id` | Delete student | Yes (Admin) |
| GET | `/api/users/blocked` | Get blocked users | Yes (Admin) |
| PUT | `/api/users/:id/unblock` | Unblock user | Yes (Admin) |
| PUT | `/api/users/:id/block` | Block user | Yes (Admin) |
| GET | `/api/users/:id/history` | Get test history | Yes (Admin) |
| GET | `/api/users/reports/:sessionId` | Get test report | Yes (Admin) |

### Utility
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/ping` | Internet speed check | No |
| GET | `/health` | Server health check | No |

## WebSocket Connection

Connect to `ws://<server-ip>:<port>` for real-time communication.

### Message Types

**Client → Server:**
```json
{ "type": "auth", "userId": "...", "token": "..." }
{ "type": "heartbeat" }
{ "type": "keypress" }
```

**Server → Client:**
```json
{ "type": "auth_success", "message": "..." }
{ "type": "heartbeat_ack", "remainingTime": 123456 }
{ "type": "keypress_ack", "count": 1, "remaining": 2 }
{ "type": "blocked", "reason": "excessive_keys", "message": "..." }
```

## Security Features

1. **JWT Authentication**: All protected endpoints require valid JWT tokens
2. **Rate Limiting**: 
   - 30 requests/minute per IP for student endpoints
   - 5 requests/10 seconds per user for subject fetch
   - 10 requests/second per user for admin endpoints
3. **Auto-blocking**: Users are automatically blocked for:
   - Excessive key presses (>3 allowed keys)
   - Internet disconnection during test
   - Rate limit violations
   - Heartbeat timeout (30 seconds)

## Deployment on Contabo (Ubuntu 22.04)

1. Install Node.js and MongoDB:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mongodb
```

2. Clone repository and install dependencies:
```bash
cd /var/www/exam-system/server
npm install --production
```

3. Set up environment variables:
```bash
cp .env.example .env
nano .env  # Edit with production values
```

4. Run with PM2:
```bash
sudo npm install -g pm2
pm2 start src/index.js --name exam-server
pm2 save
pm2 startup
```

5. Configure firewall:
```bash
sudo ufw allow 3000/tcp
```

## Docker Deployment

See `docker-compose.yml` in the root directory for Docker deployment.

## License
MIT
