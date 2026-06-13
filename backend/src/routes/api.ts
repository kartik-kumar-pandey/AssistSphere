import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Role } from '@prisma/client';
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js';
import { signToken } from '../auth/jwt.js';
import { config } from '../config.js';
import { prisma } from '../db/client.js';
import {
  createSession,
  joinSession,
  endSession,
  getSessionHistory,
  getActiveSessions,
  getAllSessions,
} from '../services/session.service.js';
import { getRecording, getSessionRecordings } from '../services/recording.service.js';
import { incrementErrors } from '../metrics/prometheus.js';

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const uploadDir = path.join(process.cwd(), config.uploadsDir);
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

const limiter = rateLimit({ windowMs: 60_000, max: 100 });

export function createApiRouter(onForceEnd?: (sessionId: string) => void): Router {
  const router = Router();
  router.use(limiter);

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Agent authentication
  router.post('/auth/agent', async (req, res) => {
    try {
      const { name, secret } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      if (secret !== config.agentSecret) {
        return res.status(403).json({ error: 'Invalid agent credentials' });
      }
      const token = signToken({
        sub: `agent-${Date.now()}`,
        role: Role.AGENT,
        name: name.trim(),
      });
      res.json({ token, name: name.trim() });
    } catch (err) {
      incrementErrors();
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Admin authentication
  router.post('/auth/admin', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (username !== config.adminUsername || password !== config.adminPassword) {
        return res.status(403).json({ error: 'Invalid admin credentials' });
      }
      const token = signToken({
        sub: 'admin',
        role: Role.ADMIN,
        name: 'Admin',
      });
      res.json({ token });
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Create session (agent only)
  router.post('/sessions', authMiddleware, requireRole(Role.AGENT), async (req: AuthRequest, res: Response) => {
    try {
      const agentName = req.user!.name;
      const result = await createSession(agentName);
      res.status(201).json({
        sessionId: result.session.id,
        inviteToken: result.inviteToken,
        inviteLink: `${config.frontendUrl}/join/${result.inviteToken}`,
        token: result.token,
        participantId: result.participant.id,
      });
    } catch (err) {
      incrementErrors();
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // Validate invite token
  router.get('/sessions/invite/:token', async (req, res) => {
    try {
      const session = await prisma.session.findUnique({
        where: { inviteToken: paramId(req.params.token) },
        select: { id: true, status: true, agentName: true, startedAt: true },
      });
      if (!session) return res.status(404).json({ error: 'Invalid invite link' });
      if (session.status !== 'ACTIVE') return res.status(410).json({ error: 'Session has ended' });
      res.json({ valid: true, agentName: session.agentName, sessionId: session.id });
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to validate invite' });
    }
  });

  // Customer join
  router.post('/sessions/join/:token', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

      const result = await joinSession(paramId(req.params.token), name.trim());
      res.json({
        sessionId: result.session.id,
        token: result.token,
        participantId: result.participant.id,
        agentName: result.session.agentName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'INVALID_INVITE') return res.status(404).json({ error: 'Invalid invite link' });
      if (message === 'SESSION_ENDED') return res.status(410).json({ error: 'Session has ended' });
      incrementErrors();
      res.status(500).json({ error: 'Failed to join session' });
    }
  });

  // End session (agent or admin)
  router.post(
    '/sessions/:id/end',
    authMiddleware,
    requireRole(Role.AGENT, Role.ADMIN),
    async (req: AuthRequest, res: Response) => {
      try {
        const session = await endSession(paramId(req.params.id), req.user!.name);
        if (!session) return res.status(404).json({ error: 'Session not found or already ended' });
        res.json({ success: true });
      } catch {
        incrementErrors();
        res.status(500).json({ error: 'Failed to end session' });
      }
    }
  );

  // Session history
  router.get('/sessions/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const history = await getSessionHistory(paramId(req.params.id));
      if (!history) return res.status(404).json({ error: 'Session not found' });

      const sessionId = paramId(req.params.id);
      const isParticipant =
        req.user!.sessionId === sessionId ||
        req.user!.role === Role.ADMIN ||
        (req.user!.role === Role.AGENT && history.agentName === req.user!.name);

      if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

      res.json(history);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch session' });
    }
  });

  // Chat messages
  router.get('/sessions/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
      const messages = await prisma.message.findMany({
        where: { sessionId: paramId(req.params.id) },
        orderBy: { createdAt: 'asc' },
      });
      res.json(messages);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // File upload
  router.post(
    '/sessions/:id/files',
    authMiddleware,
    upload.single('file'),
    async (req: AuthRequest, res: Response) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const session = await prisma.session.findUnique({ where: { id: paramId(req.params.id) } });
        if (!session || session.status !== 'ACTIVE') {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ error: 'Session not active' });
        }

        const fileRecord = await prisma.sessionFile.create({
          data: {
            sessionId: paramId(req.params.id),
            filename: req.file.filename,
            originalName: req.file.originalname,
            uploader: req.user!.name,
            uploaderRole: req.user!.role,
            url: `/api/files/${req.file.filename}`,
            mimeType: req.file.mimetype,
            size: req.file.size,
          },
        });

        res.status(201).json(fileRecord);
      } catch {
        incrementErrors();
        res.status(500).json({ error: 'File upload failed' });
      }
    }
  );

  router.get('/files/:filename', (req, res) => {
    const filePath = path.join(uploadDir, paramId(req.params.filename));
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.sendFile(filePath);
  });

  // Recordings
  router.get('/sessions/:id/recordings', authMiddleware, requireRole(Role.AGENT, Role.ADMIN), async (req, res) => {
    try {
      const recordings = await getSessionRecordings(paramId(req.params.id));
      res.json(recordings);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch recordings' });
    }
  });

  router.get('/recordings/:id', authMiddleware, async (req, res) => {
    try {
      const recording = await getRecording(paramId(req.params.id));
      if (!recording) return res.status(404).json({ error: 'Recording not found' });
      res.json(recording);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch recording' });
    }
  });

  router.get('/recordings/:id/download', authMiddleware, async (req, res) => {
    try {
      const recording = await getRecording(paramId(req.params.id));
      if (!recording || recording.status !== 'READY' || !recording.filePath) {
        return res.status(404).json({ error: 'Recording not available' });
      }
      if (!fs.existsSync(recording.filePath)) {
        return res.status(404).json({ error: 'Recording file not found' });
      }
      res.download(recording.filePath, `recording-${recording.id}.webm`);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // Admin routes
  router.get('/admin/sessions/live', authMiddleware, requireRole(Role.ADMIN), async (_req, res) => {
    try {
      const sessions = await getActiveSessions();
      res.json(sessions);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch live sessions' });
    }
  });

  router.get('/admin/sessions', authMiddleware, requireRole(Role.ADMIN), async (_req, res) => {
    try {
      const sessions = await getAllSessions();
      res.json(sessions);
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to fetch sessions' });
    }
  });

  router.delete('/admin/sessions/:id', authMiddleware, requireRole(Role.ADMIN), async (req, res) => {
    try {
      await endSession(paramId(req.params.id), 'Admin');
      onForceEnd?.(paramId(req.params.id));
      res.json({ success: true });
    } catch {
      incrementErrors();
      res.status(500).json({ error: 'Failed to end session' });
    }
  });

  return router;
}
