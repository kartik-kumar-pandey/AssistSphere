import { prisma } from '../src/db/client.js';
import { downloadFromStorage } from '../src/services/storage.service.js';
import * as dotenv from 'dotenv';
dotenv.config();

async function inspect() {
  const recordings = await prisma.recording.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5
  });

  console.log('--- LATEST 5 RECORDINGS ---');
  for (const rec of recordings) {
    console.log({
      id: rec.id,
      sessionId: rec.sessionId,
      status: rec.status,
      filePath: rec.filePath,
      fileUrl: rec.fileUrl,
      encrypted: rec.encrypted,
      encryptionIv: rec.encryptionIv,
      encryptionTag: rec.encryptionTag,
      startedAt: rec.startedAt,
      endedAt: rec.endedAt,
    });

    if (rec.filePath && rec.status === 'READY') {
      try {
        console.log(`Checking if file exists in OCI: ${rec.filePath}`);
        const buffer = await downloadFromStorage(rec.filePath);
        console.log(`✅ File found in OCI. Size: ${buffer.length} bytes`);
      } catch (err) {
        console.error(`❌ Failed to read file from OCI:`, err instanceof Error ? err.message : err);
      }
    }
    console.log('---------------------------');
  }
}

inspect();
