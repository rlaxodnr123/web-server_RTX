import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { Server, Socket } from "socket.io";
import pool from "./config/database";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./config/jwt";
import authRoutes from "./routes/auth.routes";
import classroomRoutes from "./routes/classroom.routes";
import reservationRoutes from "./routes/reservation.routes";
import waitlistRoutes from "./routes/waitlist.routes";
import statisticsRoutes from "./routes/statistics.routes";
import notificationRoutes from "./routes/notification.routes";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Socket.IO 서버 초기화
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Socket.IO JWT 인증 미들웨어
io.use(async (socket: Socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      role: string;
    };
    (socket as any).data.userId = decoded.id;
    next();
  } catch (error) {
    next(new Error("Authentication error"));
  }
});

// Socket.IO 연결 핸들러
io.on("connection", (socket: Socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 강의실 구독
  socket.on("subscribe:classroom", (classroomId: number) => {
    socket.join(`classroom:${classroomId}`);
    console.log(`Socket ${socket.id} subscribed to classroom:${classroomId}`);
  });

  // 강의실 구독 해제
  socket.on("unsubscribe:classroom", (classroomId: number) => {
    socket.leave(`classroom:${classroomId}`);
    console.log(
      `Socket ${socket.id} unsubscribed from classroom:${classroomId}`
    );
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ngrok 경고 페이지 제거 헤더
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 라우트 연결
app.use("/api/auth", authRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/notifications", notificationRoutes);

// 프론트엔드 정적 파일 서빙
// 개발 환경: __dirname은 src 폴더, 빌드 환경: __dirname은 dist 폴더
const isDevelopment = __dirname.includes("src");
const frontendPath = isDevelopment
  ? path.join(__dirname, "../../frontend/dist")
  : path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendPath));

// 환경 변수 설정 엔드포인트 (프론트엔드에서 사용)
app.get("/api/config", (req, res) => {
  const ngrokUrl = process.env.NGROK_URL || "";
  res.json({
    apiUrl: ngrokUrl ? `${ngrokUrl}/api` : "/api",
    socketUrl: ngrokUrl || "http://localhost:8000",
  });
});

// 모든 라우트를 프론트엔드로 리다이렉트 (SPA 라우팅 지원)
// Express 5에서는 와일드카드 * 대신 미들웨어를 사용
app.use((req, res, next) => {
  // API 라우트는 제외
  if (req.path.startsWith("/api")) {
    return next();
  }
  // 정적 파일이 존재하지 않으면 index.html 반환 (SPA 라우팅)
  res.sendFile(path.join(frontendPath, "index.html"), (err) => {
    if (err) {
      next(err);
    }
  });
});

// 에러 핸들러
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
);

const PORT = Number(process.env.PORT) || 8000;

// 모든 네트워크 인터페이스에서 리스닝 (IPv4와 IPv6 모두 지원)
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Server also accessible at http://localhost:${PORT}`);
});

// 테이블 초기화
async function initializeDatabase() {
  try {
    const { initializeDatabase, createDefaultAdmin } = await import(
      "./config/init"
    );
    await initializeDatabase();
    await createDefaultAdmin();
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

initializeDatabase().then(async () => {
  const { startNotificationScheduler } = await import("./utils/scheduler");
  startNotificationScheduler();
});
