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

  return recording;
}

export async function saveRecordingFile(
  sessionId: string,
  recordingId: string,
  fileBuffer: Buffer
) {
  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, sessionId },
  });
  if (!recording) throw new Error('Recording not found');

  const dir = path.join(process.cwd(), config.recordingsDir, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${recordingId}.webm`;
  const filePath = path.join(dir, filename);

  fs.writeFileSync(filePath, fileBuffer);

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
      payload: { recordingId, size: fileBuffer.length },
    },
  });

  return { filePath, fileUrl: `/api/recordings/${recordingId}/download` };
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
