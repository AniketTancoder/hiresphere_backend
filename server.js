const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const initializeAdmin = require('./scripts/initAdmin');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const connectedUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    socket.userId = decoded.id || decoded._id;
    socket.userType = decoded.type || 'admin';
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId} (${socket.userType})`);

  connectedUsers.set(`${socket.userType}_${socket.userId}`, socket.id);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId} (${socket.userType})`);
    connectedUsers.delete(`${socket.userType}_${socket.userId}`);
  });

  socket.on('mark_notification_read', async (data) => {
    try {
      const Notification = require('./models/Notification');
      await Notification.findByIdAndUpdate(data.notificationId, { isRead: true });

      socket.emit('notification_updated', { notificationId: data.notificationId, isRead: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  });
});

const sendRealTimeNotification = (userId, userType, notification) => {
  const socketId = connectedUsers.get(`${userType}_${userId}`);
  if (socketId) {
    io.to(socketId).emit('new_notification', notification);
  }
};

global.sendRealTimeNotification = sendRealTimeNotification;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/candidate', require('./routes/candidateAuth'));
app.use('/api/candidate/jobs', require('./routes/candidateJobs'));

app.use('/api/admin/jobs', require('./routes/adminJobs'));
app.use('/api/admin/candidates', require('./routes/adminCandidates'));
app.use('/api/admin/candidate-profiles', require('./routes/adminCandidateProfiles'));
app.use('/api/admin/applications', require('./routes/adminApplications'));
app.use('/api/admin/analytics', require('./routes/adminAnalytics'));
app.use('/api/admin/email', require('./routes/emailLogs'));

app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/custom-notifications', require('./routes/customNotifications'));

app.use('/api/ai', require('./routes/ai'));

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/talentsphere');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');
  await initializeAdmin();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});