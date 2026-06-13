import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  agentSecret: process.env.AGENT_SECRET || 'agent-secret-key',
  reconnectGraceMs: parseInt(process.env.RECONNECT_GRACE_MS || '30000', 10),
  mediasoup: {
    announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
    minPort: parseInt(process.env.MEDIASOUP_MIN_PORT || '40000', 10),
    maxPort: parseInt(process.env.MEDIASOUP_MAX_PORT || '49999', 10),
  },
  uploadsDir: 'uploads',
  recordingsDir: 'recordings',
};
