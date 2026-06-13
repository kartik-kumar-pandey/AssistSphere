import { Server, Socket } from 'socket.io';
import { Role } from '@prisma/client';
import { verifyToken, JwtPayload } from '../auth/jwt.js';
import { prisma } from '../db/client.js';
import {
  initMediasoup,
  createRoom,
  destroyRoom,
  addPeer,
  removePeer,
  createWebRtcTransport,
  connectTransport,
  produce,
  consume,
  resumeConsumer,
  getRouterRtpCapabilities,
  getOtherProducers,
  closeProducer,
  getRoomPeers,
  getRoomCount,
  getParticipantCount,
} from '../services/mediasoup.service.js';
import { endSession, leaveParticipant } from '../services/session.service.js';
import { startRecording, stopRecording } from '../services/recording.service.js';
import {
  scheduleDisconnect,
  cancelDisconnectByParticipant,
  getGracePeriodMs,
} from '../services/reconnect.service.js';
import {
  activeSessionsGauge,
  connectedParticipantsGauge,
  incrementErrors,
} from '../metrics/prometheus.js';

interface SocketData {
  user: JwtPayload;
  sessionId: string;
  peerId: string;
  joined: boolean;
  handlersRegistered: boolean;
}

const sessionSockets = new Map<string, Set<string>>();

type AckFn = (result: object) => void;

function getAck(args: unknown[]): AckFn | null {
  const last = args[args.length - 1];
  return typeof last === 'function' ? (last as AckFn) : null;
}

function updateMetrics() {
  activeSessionsGauge.set(getRoomCount());
  connectedParticipantsGauge.set(getParticipantCount());
}

export async function setupSocketServer(io: Server) {
  await initMediasoup();

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    if (!token) return next(new Error('Authentication required'));
    try {
      const user = verifyToken(token);
      if (!user.sessionId && user.role !== Role.ADMIN) {
        return next(new Error('Session context required'));
      }
      (socket.data as SocketData).user = user;
      (socket.data as SocketData).sessionId = user.sessionId || '';
      (socket.data as SocketData).peerId = user.participantId || user.sub;
      (socket.data as SocketData).joined = false;
      (socket.data as SocketData).handlersRegistered = false;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    const { user } = data;

    console.log(`Socket connected: ${user.name} (${user.role})`);

    if (user.role === Role.ADMIN) {
      socket.join('admin');
      return;
    }

    socket.on('room:join', async (...args: unknown[]) => {
      const cb = getAck(args);
      if (!cb) {
        console.error('room:join called without ack callback');
        return;
      }
      try {
        const roomData = await handleSessionJoin(io, socket, user, data.sessionId, data.peerId);
        (socket.data as SocketData).joined = true;
        cb({ success: true, ...roomData });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to join room';
        console.error('room:join failed:', message);
        incrementErrors();
        cb({ success: false, error: message });
      }
    });

    socket.on('disconnect', () => {
      if ((socket.data as SocketData).joined) {
        handleDisconnect(io, socket, data.sessionId, data.peerId, user);
      }
      console.log(`Socket disconnected: ${user.name}`);
    });
  });
}

async function handleSessionJoin(
  io: Server,
  socket: Socket,
  user: JwtPayload,
  sessionId: string,
  peerId: string
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('Session not found');
  if (session.status !== 'ACTIVE') throw new Error('Session has ended');

  if (user.participantId) {
    cancelDisconnectByParticipant(user.participantId);
  }

  removePeer(sessionId, peerId);
  await createRoom(sessionId);
  addPeer(sessionId, peerId, user.name, user.role);

  socket.join(sessionId);

  if (!sessionSockets.has(sessionId)) {
    sessionSockets.set(sessionId, new Set());
  }
  sessionSockets.get(sessionId)!.add(socket.id);

  if (user.participantId) {
    try {
      await prisma.participant.update({
        where: { id: user.participantId },
        data: { socketId: socket.id },
      });
    } catch {
      // Participant record may not exist yet — don't block join
    }
  }

  if (!(socket.data as SocketData).handlersRegistered) {
    registerMediaHandlers(io, socket, sessionId, peerId, user);
    registerChatHandlers(io, socket, sessionId, user);
    registerSessionHandlers(io, socket, sessionId, peerId, user);
    (socket.data as SocketData).handlersRegistered = true;
  }

  socket.to(sessionId).emit('peer:joined', {
    peerId,
    name: user.name,
    role: user.role,
  });

  updateMetrics();

  console.log(`Joined room ${sessionId}: ${user.name} (${user.role})`);

  console.log(`JOIN ${sessionId} peer=${peerId} socket=${socket.id} producers=${getOtherProducers(sessionId, peerId).length}`);

  return {
    peerId,
    peers: getRoomPeers(sessionId).filter((p) => p.id !== peerId),
    rtpCapabilities: getRouterRtpCapabilities(sessionId),
    gracePeriodMs: getGracePeriodMs(),
  };
}

function registerMediaHandlers(
  io: Server,
  socket: Socket,
  sessionId: string,
  peerId: string,
  user: JwtPayload
) {
  socket.on('getRouterRtpCapabilities', (cb: (caps: object) => void) => {
    try {
      cb(getRouterRtpCapabilities(sessionId));
    } catch {
      cb({});
    }
  });

  socket.on('createTransport', async (...args: unknown[]) => {
    const cb = getAck(args);
    if (!cb) return;
    try {
      const transport = await createWebRtcTransport(sessionId, peerId);
      cb({ success: true, transport });
    } catch (err) {
      console.error('createTransport error:', err);
      incrementErrors();
      cb({ success: false, error: 'Failed to create transport' });
    }
  });

  socket.on(
    'connectTransport',
    async ({ transportId, dtlsParameters }: { transportId: string; dtlsParameters: object }, cb) => {
      try {
        await connectTransport(sessionId, peerId, transportId, dtlsParameters);
        cb({ success: true });
      } catch (err) {
        console.error('connectTransport error:', err);
        incrementErrors();
        cb({ success: false });
      }
    }
  );

  socket.on(
    'produce',
    async (
      { transportId, kind, rtpParameters }: { transportId: string; kind: 'audio' | 'video'; rtpParameters: object },
      cb
    ) => {
      try {
        const { id } = await produce(sessionId, peerId, transportId, kind, rtpParameters);
        console.log(`NEW PRODUCER ${id} (${kind}) peer=${peerId} room=${sessionId}`);
        socket.to(sessionId).emit('newProducer', {
          peerId,
          producerId: id,
          kind,
          name: user.name,
          role: user.role,
        });
        cb({ success: true, id });
      } catch (err) {
        console.error('produce error:', err);
        incrementErrors();
        cb({ success: false });
      }
    }
  );

  socket.on('getProducers', (...args: unknown[]) => {
    const cb = getAck(args);
    if (!cb) return;
    const producers = getOtherProducers(sessionId, peerId);
    console.log(`GET PRODUCERS peer=${peerId} count=${producers.length}`);
    cb(producers);
  });

  socket.on(
    'consume',
    async (
      { transportId, producerId, rtpCapabilities }: { transportId: string; producerId: string; rtpCapabilities: object },
      cb
    ) => {
      try {
        const consumer = await consume(sessionId, peerId, transportId, producerId, rtpCapabilities);
        console.log(`CREATE CONSUMER ${consumer.id} for producer=${producerId} peer=${peerId}`);
        cb({ success: true, consumer });
      } catch (err) {
        console.error('consume error:', err);
        incrementErrors();
        cb({ success: false, error: err instanceof Error ? err.message : 'Consume failed' });
      }
    }
  );

  socket.on('resumeConsumer', async ({ consumerId }: { consumerId: string }, cb) => {
    try {
      await resumeConsumer(sessionId, peerId, consumerId);
      cb({ success: true });
    } catch {
      incrementErrors();
      cb({ success: false });
    }
  });

  socket.on('closeProducer', ({ producerId }: { producerId: string }) => {
    closeProducer(sessionId, peerId, producerId);
    socket.to(sessionId).emit('producerClosed', { peerId, producerId });
  });

  socket.on('mediaState', ({ audio, video }: { audio: boolean; video: boolean }) => {
    socket.to(sessionId).emit('peer:mediaState', { peerId, name: user.name, audio, video });
  });
}

function registerChatHandlers(io: Server, socket: Socket, sessionId: string, user: JwtPayload) {
  socket.on('chat:message', async ({ text }: { text: string }) => {
    if (!text?.trim()) return;

    try {
      const message = await prisma.message.create({
        data: {
          sessionId,
          senderName: user.name,
          senderRole: user.role,
          text: text.trim(),
        },
      });

      io.to(sessionId).emit('chat:message', message);
      console.log(`CHAT [${sessionId}] ${user.name}: ${text.trim()}`);
    } catch {
      incrementErrors();
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('chat:file', async (fileData: { fileUrl: string; fileName: string; fileMime: string }) => {
    try {
      const message = await prisma.message.create({
        data: {
          sessionId,
          senderName: user.name,
          senderRole: user.role,
          text: `Shared a file: ${fileData.fileName}`,
          fileUrl: fileData.fileUrl,
          fileName: fileData.fileName,
          fileMime: fileData.fileMime,
        },
      });

      io.to(sessionId).emit('chat:message', message);
    } catch {
      incrementErrors();
    }
  });
}

function registerSessionHandlers(
  io: Server,
  socket: Socket,
  sessionId: string,
  peerId: string,
  user: JwtPayload
) {
  socket.on('session:end', async (...args: unknown[]) => {
    const cb = getAck(args);
    if (user.role !== Role.AGENT && user.role !== Role.ADMIN) {
      cb?.({ success: false, error: 'Only agents can end sessions' });
      return;
    }

    try {
      await endSession(sessionId, user.name);
      io.to(sessionId).emit('session:ended', { reason: 'Session ended by agent' });
      cleanupSession(io, sessionId);
      cb?.({ success: true });
    } catch {
      incrementErrors();
      cb?.({ success: false });
    }
  });

  socket.on('recording:start', async (...args: unknown[]) => {
    const cb = getAck(args);
    if (user.role !== Role.AGENT) {
      cb?.({ success: false, error: 'Only agents can start recording' });
      return;
    }

    try {
      const recording = await startRecording(sessionId);
      io.to(sessionId).emit('recording:status', { status: 'IN_PROGRESS', recordingId: recording.id });
      cb?.({ success: true, recording });
    } catch {
      incrementErrors();
      cb?.({ success: false });
    }
  });

  socket.on('recording:stop', async ({ recordingId }: { recordingId: string }, cb?: (result: object) => void) => {
    if (user.role !== Role.AGENT) {
      cb?.({ success: false, error: 'Only agents can stop recording' });
      return;
    }

    try {
      await stopRecording(sessionId, recordingId);
      io.to(sessionId).emit('recording:status', { status: 'PROCESSING', recordingId });
      cb?.({ success: true });

      setTimeout(async () => {
        io.to(sessionId).emit('recording:status', { status: 'READY', recordingId });
      }, 3500);
    } catch {
      incrementErrors();
      cb?.({ success: false });
    }
  });

  socket.on('leave', async () => {
    await handleLeave(io, socket, sessionId, peerId, user, false);
  });
}

function handleDisconnect(
  io: Server,
  socket: Socket,
  sessionId: string,
  peerId: string,
  user: JwtPayload
) {
  if (user.participantId) {
    scheduleDisconnect(socket.id, sessionId, peerId, user.participantId, async () => {
      removePeer(sessionId, peerId);
      await leaveParticipant(user.participantId!);
      io.to(sessionId).emit('peer:left', { peerId, name: user.name });
      updateMetrics();
    });
  } else {
    handleLeave(io, socket, sessionId, peerId, user, true);
  }
}

async function handleLeave(
  io: Server,
  socket: Socket,
  sessionId: string,
  peerId: string,
  user: JwtPayload,
  isDisconnect: boolean
) {
  const sockets = sessionSockets.get(sessionId);
  if (sockets) {
    sockets.delete(socket.id);
    if (sockets.size === 0) sessionSockets.delete(sessionId);
  }

  removePeer(sessionId, peerId);

  if (isDisconnect) {
    return;
  }

  if (user.participantId) {
    await leaveParticipant(user.participantId);
  }

  socket.to(sessionId).emit('peer:left', { peerId, name: user.name });
  updateMetrics();
}

function cleanupSession(io: Server, sessionId: string) {
  destroyRoom(sessionId);
  sessionSockets.delete(sessionId);
  io.in(sessionId).socketsLeave(sessionId);
  updateMetrics();
}

export function forceEndSession(io: Server, sessionId: string) {
  io.to(sessionId).emit('session:ended', { reason: 'Session ended by administrator' });
  cleanupSession(io, sessionId);
}
