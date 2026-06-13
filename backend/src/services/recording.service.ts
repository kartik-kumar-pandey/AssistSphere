import { RecordingStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';

const activeRecordings = new Map<string, { sessionId: string; startedAt: Date }>();

export async function startRecording(sessionId: string) {
  const existing = await prisma.recording.findFirst({
    where: { sessionId, status: RecordingStatus.IN_PROGRESS },
  });
  if (existing) return existing;

  const recording = await prisma.recording.create({
    data: { sessionId, status: RecordingStatus.IN_PROGRESS },
  });

  activeRecordings.set(recording.id, { sessionId, startedAt: new Date() });

  await prisma.event.create({
    data: {
      sessionId,
      type: 'RECORDING_STARTED',
      payload: { recordingId: recording.id },
    },
  });

  return recording;
}

export async function stopRecording(sessionId: string, recordingId: string) {
  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, sessionId, status: RecordingStatus.IN_PROGRESS },
  });
  if (!recording) return null;

  activeRecordings.delete(recordingId);

  await prisma.recording.update({
    where: { id: recordingId },
    data: { status: RecordingStatus.PROCESSING, endedAt: new Date() },
  });

  await prisma.event.create({
    data: {
      sessionId,
      type: 'RECORDING_STOPPED',
      payload: { recordingId },
    },
  });

  // Simulate processing — in production use FFmpeg with mediasoup PlainTransport
  setTimeout(async () => {
    const dir = path.join(process.cwd(), config.recordingsDir, sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${recordingId}.webm`;
    const filePath = path.join(dir, filename);

    // Placeholder metadata file (real impl would mux RTP streams via FFmpeg)
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        note: 'Recording placeholder — integrate FFmpeg with mediasoup PlainTransport for production',
        sessionId,
        recordingId,
        createdAt: new Date().toISOString(),
      })
    );

    await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: RecordingStatus.READY,
        filePath,
        fileUrl: `/api/recordings/${recordingId}/download`,
      },
    });

    await prisma.event.create({
      data: {
        sessionId,
        type: 'RECORDING_READY',
        payload: { recordingId },
      },
    });
  }, 3000);

  return recording;
}

export async function getRecording(recordingId: string) {
  return prisma.recording.findUnique({ where: { id: recordingId } });
}

export async function getSessionRecordings(sessionId: string) {
  return prisma.recording.findMany({
    where: { sessionId },
    orderBy: { startedAt: 'desc' },
  });
}

export function isRecordingActive(sessionId: string): boolean {
  for (const [, rec] of activeRecordings) {
    if (rec.sessionId === sessionId) return true;
  }
  return false;
}
