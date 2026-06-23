import { prisma } from '../src/db/client.js';
import { decryptRecordingFile } from '../src/services/recording.service.js';
import { downloadFromStorage } from '../src/services/storage.service.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

async function inspect(id: string) {
  const rec = await prisma.recording.findUnique({ where: { id } });
  if (!rec) {
    console.error(`❌ Recording ${id} not found in DB`);
    return;
  }

  console.log('--- RECORDING DETAILS ---', rec);

  if (rec.filePath) {
    try {
      console.log('Downloading ciphertext from OCI...');
      const ciphertext = await downloadFromStorage(rec.filePath);
      console.log(`Ciphertext downloaded: ${ciphertext.length} bytes`);
      
      console.log('Decrypting...');
      const plaintext = await decryptRecordingFile(id);
      console.log(`Plaintext decrypted: ${plaintext.length} bytes`);
      
      // Let's print the first 100 bytes of the plaintext to see if it starts with EBML (WebM header)
      // WebM files start with EBML header (hex: 1A 45 DF A3)
      console.log('First 16 bytes of plaintext (hex):', plaintext.subarray(0, 16).toString('hex'));
      console.log('First 16 bytes of plaintext (ASCII):', plaintext.subarray(0, 16).toString('ascii'));
    } catch (err) {
      console.error('❌ Error during OCI fetch/decrypt:', err);
    }
  }
}

// Let's check both IDs from the user's screenshot:
// 1. cmqqu0v31000k0lns4hpawsix
// 2. cmqqu5y25000s0lns7gup5tq0
inspect('cmqqu0v31000k0lns4hpawsix').then(() => inspect('cmqqu5y25000s0lns7gup5tq0'));
