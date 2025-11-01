import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server, Socket } from 'socket.io';
import pool from './config/database';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config/jwt';
import authRoutes from './routes/auth.routes';
import classroomRoutes from './routes/classroom.routes';
import reservationRoutes from './routes/reservation.routes';
import waitlistRoutes from './routes/waitlist.routes';
import statisticsRoutes from './routes/statistics.routes';
import notificationRoutes from './routes/notification.routes';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.IO 서버 초기화
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO JWT 인증 미들웨어
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string };
    (socket as any).data.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO 연결 핸들러
io.on('connection', (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 강의실 구독
  socket.on('subscribe:classroom', (classroomId: number) => {
    socket.join(`classroom:${classroomId}`);
    console.log(`Socket ${socket.id} subscribed to classroom:${classroomId}`);
  });

  // 강의실 구독 해제
  socket.on('unsubscribe:classroom', (classroomId: number) => {
    socket.leave(`classroom:${classroomId}`);
    console.log(`Socket ${socket.id} unsubscribed from classroom:${classroomId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 라우트 연결
app.use('/api/auth', authRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/notifications', notificationRoutes);

// 에러 핸들러
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// 테이블 초기화
async function initializeDatabase() {
  try {
    const { initializeDatabase, createDefaultAdmin } = await import('./config/init');
    await initializeDatabase();
    await createDefaultAdmin();
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase().then(async () => {
  const { startNotificationScheduler } = await import('./utils/scheduler');
  startNotificationScheduler();
});

