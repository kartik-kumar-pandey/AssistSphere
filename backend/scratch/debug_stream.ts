import * as oci from 'oci-sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

const region = process.env.OCI_REGION || 'ap-mumbai-1';
const bucketName = process.env.OCI_BUCKET || 'AssistSphere';
const namespaceName = process.env.OCI_NAMESPACE || '';
const userOcid = process.env.OCI_USER_OCID || '';
const tenancyOcid = process.env.OCI_TENANCY_OCID || '';
const fingerprint = process.env.OCI_FINGERPRINT || '';
const privateKeyPath = process.env.OCI_PRIVATE_KEY_PATH || '';

const absoluteKeyPath = path.resolve(privateKeyPath);
const privateKey = fs.readFileSync(absoluteKeyPath, 'utf8');

const ociRegion = oci.common.Region.fromRegionId(region);
const provider = new oci.common.SimpleAuthenticationDetailsProvider(
  tenancyOcid,
  userOcid,
  fingerprint,
  privateKey,
  null,
  ociRegion
);

const ociClient = new oci.objectstorage.ObjectStorageClient({ authenticationDetailsProvider: provider });

async function debugStream() {
  const getRequest: oci.objectstorage.requests.GetObjectRequest = {
    namespaceName,
    bucketName,
    objectName: 'hello.txt'
  };

  const response = await ociClient.getObject(getRequest);
  console.log('--- getObject Response ---');
  console.log('typeof response.value:', typeof response.value);
  console.log('constructor of response.value:', response.value?.constructor?.name);
  console.log('keys of response.value:', Object.keys(response.value || {}));
  console.log('response.value directly:', response.value);
}

debugStream();
