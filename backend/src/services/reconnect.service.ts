import { config } from '../config.js';

interface PendingDisconnect {
  sessionId: string;
  peerId: string;
  participantId: string;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingDisconnects = new Map<string, PendingDisconnect>();

export function scheduleDisconnect(
  socketId: string,
  sessionId: string,
  peerId: string,
  participantId: string,
  onExpire: () => void
) {
  cancelDisconnect(socketId);

  const timeout = setTimeout(() => {
    pendingDisconnects.delete(socketId);
    onExpire();
  }, config.reconnectGraceMs);

  pendingDisconnects.set(socketId, { sessionId, peerId, participantId, timeout });
}

export function cancelDisconnect(socketId: string): boolean {
  const pending = pendingDisconnects.get(socketId);
  if (!pending) return false;
  clearTimeout(pending.timeout);
  pendingDisconnects.delete(socketId);
  return true;
}

export function isPendingReconnect(socketId: string): boolean {
  return pendingDisconnects.has(socketId);
}

export function getPendingByParticipant(participantId: string): PendingDisconnect | undefined {
  for (const [, pending] of pendingDisconnects) {
    if (pending.participantId === participantId) return pending;
  }
  return undefined;
}

export function getGracePeriodMs() {
  return config.reconnectGraceMs;
}

export function cancelDisconnectByParticipant(participantId: string): boolean {
  for (const [socketId, pending] of pendingDisconnects) {
    if (pending.participantId === participantId) {
      return cancelDisconnect(socketId);
    }
  }
  return false;
}
