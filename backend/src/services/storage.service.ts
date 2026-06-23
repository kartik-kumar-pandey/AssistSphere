import * as oci from 'oci-sdk';
import * as fs from 'fs';
import * as path from 'path';

// OCI configurations from env
const region = process.env.OCI_REGION || 'ap-mumbai-1';
const bucketName = process.env.OCI_BUCKET || 'AssistSphere';
const namespaceName = process.env.OCI_NAMESPACE || '';
const userOcid = process.env.OCI_USER_OCID || '';
const tenancyOcid = process.env.OCI_TENANCY_OCID || '';
const fingerprint = process.env.OCI_FINGERPRINT || '';
const privateKeyPath = process.env.OCI_PRIVATE_KEY_PATH || '';

let client: oci.objectstorage.ObjectStorageClient | null = null;

function getClient(): oci.objectstorage.ObjectStorageClient {
  if (client) return client;

  if (!namespaceName || !userOcid || !tenancyOcid || !fingerprint || !privateKeyPath) {
    throw new Error('Missing OCI configurations in environment variables.');
  }

  // Load private key
  const absoluteKeyPath = path.resolve(privateKeyPath);
  const privateKey = fs.readFileSync(absoluteKeyPath, 'utf8');

  // Config provider for OCI Authentication
  const ociRegion = oci.common.Region.fromRegionId(region);
  const provider = new oci.common.SimpleAuthenticationDetailsProvider(
    tenancyOcid,
    userOcid,
    fingerprint,
    privateKey,
    null,
    ociRegion
  );

  client = new oci.objectstorage.ObjectStorageClient({ authenticationDetailsProvider: provider });
  return client;
}

/**
 * Uploads a binary buffer to Oracle Object Storage.
 * @param objectName Destination name in the bucket.
 * @param buffer File buffer to upload.
 * @param contentType MIME type of the file.
 */
export async function uploadToStorage(
  objectName: string,
  buffer: Buffer,
  contentType: string
): Promise<{ opcRequestId: string; eTag: string }> {
  const ociClient = getClient();
  const putRequest: oci.objectstorage.requests.PutObjectRequest = {
    namespaceName,
    bucketName,
    objectName,
    putObjectBody: buffer,
    contentLength: buffer.length,
    contentType
  };

  const response = await ociClient.putObject(putRequest);
  return {
    opcRequestId: response.opcRequestId || '',
    eTag: response.eTag || ''
  };
}

/**
 * Downloads an object as a Buffer from Oracle Object Storage.
 * @param objectName Name of the object to download.
 */
export async function downloadFromStorage(objectName: string): Promise<Buffer> {
  const ociClient = getClient();
  const getRequest: oci.objectstorage.requests.GetObjectRequest = {
    namespaceName,
    bucketName,
    objectName
  };

  const response = await ociClient.getObject(getRequest);
  
  if (response.value && typeof (response.value as any).getReader === 'function') {
    const reader = (response.value as any).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks);
  } else {
    // Convert response stream to Buffer
    const chunks: any[] = [];
    return new Promise((resolve, reject) => {
      const stream = response.value as NodeJS.ReadableStream;
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

/**
 * Deletes an object from Oracle Object Storage.
 * @param objectName Name of the object to delete.
 */
export async function deleteFromStorage(objectName: string): Promise<void> {
  const ociClient = getClient();
  const deleteRequest: oci.objectstorage.requests.DeleteObjectRequest = {
    namespaceName,
    bucketName,
    objectName
  };
  await ociClient.deleteObject(deleteRequest);
}

/**
 * Generates a Pre-Authenticated Request (PAR) URL for secure access to an object.
 * PARs allow temporary access to private objects without credentials.
 * @param objectName Target file inside the bucket.
 * @param expireMinutes Lifespan of the generated URL (default: 60 mins).
 */
export async function getSignedUrl(objectName: string, expireMinutes = 60): Promise<string> {
  const ociClient = getClient();
  const parName = `par-${objectName}-${Date.now()}`;
  const timeExpires = new Date();
  timeExpires.setMinutes(timeExpires.getMinutes() + expireMinutes);

  const createParRequest: oci.objectstorage.requests.CreatePreauthenticatedRequestRequest = {
    namespaceName,
    bucketName,
    createPreauthenticatedRequestDetails: {
      name: parName,
      accessType: oci.objectstorage.models.CreatePreauthenticatedRequestDetails.AccessType.ObjectRead,
      objectName,
      timeExpires
    }
  };

  const response = await ociClient.createPreauthenticatedRequest(createParRequest);
  
  // OCI PAR response contains a accessUri which we append to the base region endpoint
  const baseUri = `https://objectstorage.${region}.oraclecloud.com`;
  return `${baseUri}${response.preauthenticatedRequest.accessUri}`;
}
