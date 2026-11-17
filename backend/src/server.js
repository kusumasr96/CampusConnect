const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./config/loadEnv');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const attendanceRoutes = require('./routes/attendance');
const scheduleRoutes = require('./routes/schedule');
const adminRoutes = require('./routes/admin');
const eventRoutes = require('./routes/events');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');
const profileRoutes = require('./routes/profile');
const timetableRoutes = require('./routes/timetables');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// App configuration & Security
app.set('socketio', io);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/timetables', timetableRoutes);

io.use((socket, next) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const tokenMatch = /(?:^|;\s*)accessToken=([^;]+)/.exec(cookieHeader);
  const accessToken = tokenMatch && tokenMatch[1];
  if (!accessToken || !process.env.JWT_ACCESS_SECRET) {
    next(new Error('Authentication required'));
    return;
  }

  jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, (error, user) => {
    if (error || !user || typeof user === 'string' || !user.id) {
      next(new Error('Authentication required'));
      return;
    }
    socket.data.userId = user.id;
    next();
  });
});

io.on('connection', (socket) => {
  socket.join(`user_${socket.data.userId}`);
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`CampusConnect server running on port ${PORT}`));
}

module.exports = { app, server };
