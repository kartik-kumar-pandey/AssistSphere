import { RecordingStatus } from '@prisma/client';
import { prisma } from '../db/client.js';
import { config } from '../config.js';
import fs from 'fs';
import path from 'path';
import {
  generateDataKey,
  wrapKey,
  unwrapKey,
  encryptBuffer,
  decryptBuffer,
} from './encryption.service.js';

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

/**
 * Encrypts the recording buffer with AES-256-GCM before writing to disk.
 *
 * Encryption flow:
 *  1. Generate a unique 256-bit DEK for this recording.
 *  2. Encrypt the raw .webm buffer with the DEK (AES-256-GCM).
 *  3. Wrap (encrypt) the DEK itself with the master key (KEK) from env.
 *  4. Store the wrapped DEK, IV, and auth tag in the database.
 *  5. Write ONLY the ciphertext to disk — plaintext never persists.
 *
 * The storage provider and anyone with only disk access cannot decrypt without the master key.
 */
export async function saveRecordingFile(
  sessionId: string,
  recordingId: string,
  fileBuffer: Buffer
) {
  const recording = await prisma.recording.findFirst({
    where: { id: recordingId, sessionId },
  });
  if (!recording) throw new Error('Recording not found');

  // Step 1: Generate unique data encryption key (DEK) for this recording
  const dek = generateDataKey();

  // Step 2: Encrypt the raw .webm buffer
  const { ciphertext, ivHex: fileIvHex, tagHex: fileTagHex } = encryptBuffer(fileBuffer, dek);

  // Step 3: Wrap DEK with master key — encryptedKeyHex goes to DB, kek stays only in env
  const { encryptedKeyHex, ivHex: keyIvHex, tagHex: keyTagHex } = wrapKey(dek);

  // Pack both IVs and tags into single strings so we reuse existing DB columns
  // Format: "<fileHex>:<keyHex>"
  const combinedIv  = `${fileIvHex}:${keyIvHex}`;
  const combinedTag = `${fileTagHex}:${keyTagHex}`;

  // Step 4: Write ciphertext to disk (NOT plaintext)
  const dir      = path.join(process.cwd(), config.recordingsDir, sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${recordingId}.enc`);
  fs.writeFileSync(filePath, ciphertext);

  // Step 5: Persist encryption metadata alongside status update
  await (prisma.recording.update as Function)({
    where: { id: recordingId },
    data: {
      status:           RecordingStatus.READY,
      filePath,
      fileUrl:          `/api/recordings/${recordingId}/download`,
      encryptionKeyEnc: encryptedKeyHex,
      encryptionIv:     combinedIv,
      encryptionTag:    combinedTag,
      encrypted:        true,
    },
  });

  await prisma.event.create({
    data: {
      sessionId,
      type:    'RECORDING_READY',
      payload: { recordingId, size: fileBuffer.length, encrypted: true },
    },
  });

  return { filePath, fileUrl: `/api/recordings/${recordingId}/download` };
}

/**
 * Decrypts and returns the plaintext recording buffer for download.
 * Throws if the file is missing, the GCM auth tag fails, or key metadata is absent.
 */
export async function decryptRecordingFile(recordingId: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recording: any = await prisma.recording.findUnique({ where: { id: recordingId } });
  if (!recording || !recording.filePath) throw new Error('Recording not found');

  if (!recording.encrypted) {
    // Legacy unencrypted recording — serve as-is for backwards compatibility
    return fs.readFileSync(recording.filePath as string);
  }

  const { encryptionKeyEnc, encryptionIv, encryptionTag, filePath } = recording as {
    encryptionKeyEnc: string | null;
    encryptionIv: string | null;
    encryptionTag: string | null;
    filePath: string;
  };

  if (!encryptionKeyEnc || !encryptionIv || !encryptionTag) {
    throw new Error('Encryption metadata missing — cannot decrypt this recording');
  }

  // Unpack combined "<fileHex>:<keyHex>" strings
  const [fileIvHex,  keyIvHex]  = encryptionIv.split(':');
  const [fileTagHex, keyTagHex] = encryptionTag.split(':');

  // Unwrap the per-recording DEK using the master key
  const dek = unwrapKey(encryptionKeyEnc, keyIvHex, keyTagHex);

  // Read ciphertext from disk and decrypt
  const ciphertext = fs.readFileSync(filePath);
  return decryptBuffer(ciphertext, dek, fileIvHex, fileTagHex);
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
