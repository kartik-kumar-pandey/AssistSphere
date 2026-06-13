import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { connectDb } from './db/client.js';
import { createApiRouter } from './routes/api.js';
import { setupSocketServer, forceEndSession } from './socket/index.js';
import { register } from './metrics/prometheus.js';

async function main() {
  fs.mkdirSync(path.join(process.cwd(), config.uploadsDir), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), config.recordingsDir), { recursive: true });

  await connectDb();
  console.log('Database connected');

  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed =
          origin === config.frontendUrl ||
          /\.vercel\.app$/.test(origin) ||
          /^http:\/\/localhost/.test(origin);
        callback(allowed ? null : new Error('Not allowed by CORS'), allowed);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 1e7,
  });

  const allowedOrigins = [
    config.frontendUrl,
    /\.vercel\.app$/,      // all Vercel preview & production URLs
    /^http:\/\/localhost/,  // local development
  ];
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json());

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.use('/api', createApiRouter((sessionId) => forceEndSession(io, sessionId)));

  await setupSocketServer(io);

  server.listen(config.port, config.host, () => {
    console.log(`Server running on http://${config.host}:${config.port}`);
    console.log(`Frontend URL: ${config.frontendUrl}`);
    console.log(`Metrics: http://localhost:${config.port}/metrics`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
