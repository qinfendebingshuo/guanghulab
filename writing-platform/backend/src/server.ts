import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import aiRoutes from './routes/ai';
import { setupSocketService } from './services/socketService';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/writing/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'writing-platform-backend',
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/writing/auth', authRoutes);
app.use('/api/writing/user', userRoutes);
app.use('/api/writing/ai', aiRoutes);

// WebSocket setup
setupSocketService(server);

const PORT = process.env.PORT || 3100;

server.listen(PORT, () => {
  console.log(`[Writing Platform] Backend running on port ${PORT}`);
  console.log(`[Writing Platform] Health: http://localhost:${PORT}/api/writing/health`);
});

export { app, server };
