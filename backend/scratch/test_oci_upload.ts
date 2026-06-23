import * as oci from 'oci-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env variables
dotenv.config();

const region = process.env.OCI_REGION || 'ap-mumbai-1';
const bucketName = process.env.OCI_BUCKET || 'AssistSphere';
const namespace = process.env.OCI_NAMESPACE;
const userOcid = process.env.OCI_USER_OCID;
const tenancyOcid = process.env.OCI_TENANCY_OCID;
const fingerprint = process.env.OCI_FINGERPRINT;
const privateKeyPath = process.env.OCI_PRIVATE_KEY_PATH;

if (!namespace || !userOcid || !tenancyOcid || !fingerprint || !privateKeyPath) {
  console.error('❌ Missing OCI configuration variables in .env');
  process.exit(1);
}

// Read private key content
let privateKey: string;
try {
  const absoluteKeyPath = path.resolve(privateKeyPath);
  privateKey = fs.readFileSync(absoluteKeyPath, 'utf8');
} catch (error) {
  console.error(`❌ Failed to read private key at ${privateKeyPath}:`, error);
  process.exit(1);
}

// Setup OCI Authentication Provider
const provider: oci.common.ConfigFileAuthenticationDetailsProvider = {
  getUniqueId(): string {
    return `${tenancyOcid}/${userOcid}/${fingerprint}`;
  },
  getKeyId(): string {
    return `${tenancyOcid}/${userOcid}/${fingerprint}`;
  },
  getPrivateKey(): string {
    return privateKey;
  },
  getPassphrase(): string | null {
    return null;
  },
  getFingerprint(): string {
    return fingerprint;
  },
  getTenancy(): string {
    return tenancyOcid;
  },
  getUser(): string {
    return userOcid;
  },
  getRegion(): oci.common.Region {
    return oci.common.Region.fromRegionId(region);
  }
};

async function testUpload() {
  console.log('⏳ Connecting to Oracle Object Storage...');
  const client = new oci.objectstorage.ObjectStorageClient({ authenticationDetailsProvider: provider });

  const testContent = `Hello AssistSphere! Upload test successful. Date: ${new Date().toISOString()}`;
  const objectName = 'hello.txt';

  console.log(`⏳ Uploading "${objectName}" to bucket "${bucketName}"...`);

  try {
    const putObjectRequest: oci.objectstorage.requests.PutObjectRequest = {
      namespaceName: namespace,
      bucketName: bucketName,
      objectName: objectName,
      putObjectBody: testContent,
      contentLength: Buffer.byteLength(testContent),
      contentType: 'text/plain'
    };

    const response = await client.putObject(putObjectRequest);
    console.log('✅ Upload successful! Response details:', {
      opcRequestId: response.opcRequestId,
      eTag: response.eTag
    });
  } catch (error) {
    console.error('❌ Upload failed with error:', error);
  }
}

testUpload();
