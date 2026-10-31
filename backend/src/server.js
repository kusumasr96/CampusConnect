const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('./config/loadEnv');

const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const attendanceRoutes = require('./routes/attendance');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
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

// Socket.IO Real-time messaging & notifications
io.on('connection', (socket) => {
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('send_message', (data) => {
    // Direct message between student and teacher
    io.to(`user_${data.recipientId}`).emit('receive_message', data);
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => console.log(`CampusConnect server running on port ${PORT}`));
}

module.exports = { app, server };
