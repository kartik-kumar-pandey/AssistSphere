import { nanoid } from 'nanoid';
import { Role, SessionStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { signToken } from '../auth/jwt.js';

export async function createSession(agentName: string) {
  const inviteToken = nanoid(12);
  const session = await prisma.session.create({
    data: {
      inviteToken,
      agentName,
      status: SessionStatus.ACTIVE,
      events: {
        create: { type: 'SESSION_CREATED', payload: { agentName } },
      },
    },
  });

  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      name: agentName,
      role: Role.AGENT,
    },
  });

  const token = signToken({
    sub: participant.id,
    role: Role.AGENT,
    sessionId: session.id,
    name: agentName,
    participantId: participant.id,
  });

  return { session, participant, token, inviteToken };
}

export async function joinSession(inviteToken: string, customerName: string) {
  const session = await prisma.session.findUnique({
    where: { inviteToken },
    include: { participants: { where: { leftAt: null } } },
  });

  if (!session) {
    throw new Error('INVALID_INVITE');
  }
  if (session.status !== SessionStatus.ACTIVE) {
    throw new Error('SESSION_ENDED');
  }

  const existing = session.participants.find(
    (p) => p.role === Role.CUSTOMER && p.name === customerName && !p.leftAt
  );
  if (existing) {
    const token = signToken({
      sub: existing.id,
      role: Role.CUSTOMER,
      sessionId: session.id,
      name: customerName,
      participantId: existing.id,
    });
    return { session, participant: existing, token };
  }

  const participant = await prisma.participant.create({
    data: {
      sessionId: session.id,
      name: customerName,
      role: Role.CUSTOMER,
    },
  });

  await prisma.event.create({
    data: {
      sessionId: session.id,
      type: 'CUSTOMER_JOINED',
      payload: { customerName },
    },
  });

  const token = signToken({
    sub: participant.id,
    role: Role.CUSTOMER,
    sessionId: session.id,
    name: customerName,
    participantId: participant.id,
  });

  return { session, participant, token };
}

export async function endSession(sessionId: string, endedBy: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { participants: { where: { leftAt: null } } },
  });
  if (!session || session.status === SessionStatus.ENDED) {
    return null;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.session.update({
      where: { id: sessionId },
      data: { status: SessionStatus.ENDED, endedAt: now },
    }),
    ...session.participants.map((p) =>
      prisma.participant.update({
        where: { id: p.id },
        data: {
          leftAt: now,
          durationSec: Math.floor((now.getTime() - p.joinedAt.getTime()) / 1000),
        },
      })
    ),
    prisma.event.create({
      data: {
        sessionId,
        type: 'SESSION_ENDED',
        payload: { endedBy },
      },
    }),
  ]);

  return session;
}

export async function leaveParticipant(participantId: string) {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
  });
  if (!participant || participant.leftAt) return;

  const now = new Date();
  await prisma.participant.update({
    where: { id: participantId },
    data: {
      leftAt: now,
      durationSec: Math.floor((now.getTime() - participant.joinedAt.getTime()) / 1000),
    },
  });

  await prisma.event.create({
    data: {
      sessionId: participant.sessionId,
      type: 'PARTICIPANT_LEFT',
      payload: { name: participant.name, role: participant.role },
    },
  });
}

export async function getSessionHistory(sessionId: string) {
  return prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { orderBy: { joinedAt: 'asc' } },
      messages: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      recordings: { orderBy: { startedAt: 'desc' } },
      files: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function getActiveSessions() {
  return prisma.session.findMany({
    where: { status: SessionStatus.ACTIVE },
    include: {
      participants: { where: { leftAt: null } },
      recordings: { where: { status: 'IN_PROGRESS' } },
    },
    orderBy: { startedAt: 'desc' },
  });
}

export async function getAllSessions(limit = 50) {
  return prisma.session.findMany({
    include: {
      participants: true,
      _count: { select: { messages: true, files: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}
