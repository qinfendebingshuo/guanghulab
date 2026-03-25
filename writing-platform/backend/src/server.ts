import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get('/api/writing/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'writing-platform-backend',
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3100;

server.listen(PORT, () => {
  console.log(`Writing platform backend running on port ${PORT}`);
});

export { app, server };
