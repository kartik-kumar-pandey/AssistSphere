import { decryptRecordingFile } from '../src/services/recording.service.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const recordingId = 'cmqc32pxn00020lxg08gghxox';
  try {
    console.log(`⏳ Decrypting recording ${recordingId}...`);
    const plaintext = await decryptRecordingFile(recordingId);
    console.log(`✅ Decrypted successfully! Size: ${plaintext.length} bytes`);
    
    fs.writeFileSync('scratch/decrypted_test.webm', plaintext);
    console.log('✅ Decrypted file saved to scratch/decrypted_test.webm');
  } catch (err) {
    console.error('❌ Decryption failed with error:', err);
  }
}

test();
