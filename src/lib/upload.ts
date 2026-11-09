import { Readable } from 'stream';
import axios from 'axios';
import prisma from './prisma';
import { getDriveClient, getAuthenticatedClient, withRetry } from './google-drive';

const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB chunks

interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  status: 'uploading' | 'completed' | 'error';
  currentChunk?: number;
  totalChunks?: number;
}

// In-memory progress tracking
const uploadProgressMap = new Map<string, UploadProgress>();

export function getUploadProgress(uploadId: string): UploadProgress | undefined {
  return uploadProgressMap.get(uploadId);
}

export function setUploadProgress(uploadId: string, progress: UploadProgress) {
  uploadProgressMap.set(uploadId, progress);
}

export function clearUploadProgress(uploadId: string) {
  uploadProgressMap.delete(uploadId);
}

/**
 * Find the best drive account with the most available space.
 */
export async function findBestDriveAccount(requiredBytes: bigint, userId?: string) {
  const accounts = await prisma.driveAccount.findMany({
    where: {
      status: 'active',
      ...(userId ? { userId } : {}),
    },
    orderBy: { usedBytes: 'asc' },
  });

  // Find account with most free space that can fit the file
  for (const account of accounts) {
    const freeSpace = account.totalBytes - account.usedBytes;
    if (freeSpace >= requiredBytes) {
      return account;
    }
  }

  return null;
}

/**
 * Find accounts for split upload across multiple drives.
 */
export async function findAccountsForSplitUpload(totalBytes: bigint, userId?: string) {
  const accounts = await prisma.driveAccount.findMany({
    where: {
      status: 'active',
      ...(userId ? { userId } : {}),
    },
    orderBy: { usedBytes: 'asc' },
  });

  let remaining = totalBytes;
  const plan: Array<{ accountId: string; email: string; bytes: bigint }> = [];

  for (const account of accounts) {
    if (remaining <= BigInt(0)) break;

    const freeSpace = account.totalBytes - account.usedBytes;
    if (freeSpace <= BigInt(0)) continue;

    const toAllocate = freeSpace < remaining ? freeSpace : remaining;
    plan.push({
      accountId: account.id,
      email: account.email,
      bytes: toAllocate,
    });
    remaining -= toAllocate;
  }

  if (remaining > BigInt(0)) {
    throw new Error('Insufficient total storage across all drive accounts');
  }

  return plan;
}

/**
 * Initiate a resumable upload session with Google Drive API.
 */
export async function initiateResumableUpload(
  accountId: string,
  filename: string,
  mimeType: string,
  fileSize: number,
  origin?: string
): Promise<string> {
  const { oauth2Client } = await getAuthenticatedClient(accountId);
  const token = await oauth2Client.getAccessToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token.token}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType,
    'X-Upload-Content-Length': fileSize.toString(),
  };

  if (origin) {
    headers['Origin'] = origin;
  }

  const response = await withRetry(() =>
    axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        name: filename,
        mimeType: mimeType,
      },
      {
        headers,
      }
    )
  );

  const uploadUri = response.headers.location;
  if (!uploadUri) {
    throw new Error('Failed to get resumable upload URI');
  }

  return uploadUri;
}

/**
 * Upload a chunk to a resumable upload session.
 */
async function uploadChunkToSession(
  uploadUri: string,
  chunkData: Buffer,
  chunkStart: number,
  chunkEnd: number,
  totalSize: number
): Promise<{ fileId?: string; completed: boolean }> {
  const contentRange = `bytes ${chunkStart}-${chunkEnd}/${totalSize}`;

  try {
    const response = await withRetry(() =>
      axios.put(uploadUri, chunkData, {
        headers: {
          'Content-Length': chunkData.length.toString(),
          'Content-Range': contentRange,
        },
        validateStatus: (status) => status === 200 || status === 201 || status === 308,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
    );

    if (response.status === 200 || response.status === 201) {
      return { fileId: response.data.id, completed: true };
    }

    return { completed: false };
  } catch (error) {
    throw error;
  }
}

/**
 * Perform a full resumable upload of a file to a single drive account.
 */
export async function resumableUpload(
  uploadId: string,
  accountId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  virtualPath: string = '/',
  userId?: string
): Promise<string> {
  const totalSize = fileBuffer.length;
  const startTime = Date.now();

  // Initialize progress
  setUploadProgress(uploadId, {
    bytesUploaded: 0,
    totalBytes: totalSize,
    percentage: 0,
    speed: 0,
    status: 'uploading',
  });

  try {
    // Check if demo account
    const account = await prisma.driveAccount.findUnique({ where: { id: accountId } });
    if (account?.encryptedAccessToken === 'demo_token' || account?.email.includes('demo')) {
      const demoId = `demo_gdrive_id_${Date.now()}`;
      await prisma.fileRecord.create({
        data: {
          userId: userId || null,
          filename,
          sizeBytes: BigInt(totalSize),
          mimeType,
          virtualPath,
          googleDriveId: demoId,
          driveAccountId: accountId,
          isChunked: false,
        },
      });
      await prisma.driveAccount.update({
        where: { id: accountId },
        data: { usedBytes: { increment: BigInt(totalSize) } },
      });
      setUploadProgress(uploadId, {
        bytesUploaded: totalSize,
        totalBytes: totalSize,
        percentage: 100,
        speed: 0,
        status: 'completed',
      });
      return demoId;
    }

    // Initiate resumable upload
    const uploadUri = await initiateResumableUpload(accountId, filename, mimeType, totalSize);

    let offset = 0;
    let googleDriveId = '';

    while (offset < totalSize) {
      const chunkEnd = Math.min(offset + CHUNK_SIZE - 1, totalSize - 1);
      const chunkData = fileBuffer.subarray(offset, chunkEnd + 1);

      const result = await uploadChunkToSession(
        uploadUri,
        chunkData,
        offset,
        chunkEnd,
        totalSize
      );

      offset = chunkEnd + 1;

      // Update progress
      const elapsed = (Date.now() - startTime) / 1000;
      setUploadProgress(uploadId, {
        bytesUploaded: offset,
        totalBytes: totalSize,
        percentage: Math.round((offset / totalSize) * 100),
        speed: elapsed > 0 ? Math.round(offset / elapsed) : 0,
        status: result.completed ? 'completed' : 'uploading',
      });

      if (result.completed && result.fileId) {
        googleDriveId = result.fileId;
      }
    }

    // Create file record in database
    await prisma.fileRecord.create({
      data: {
        userId: userId || null,
        filename,
        sizeBytes: BigInt(totalSize),
        mimeType,
        virtualPath,
        googleDriveId,
        driveAccountId: accountId,
        isChunked: false,
      },
    });

    // Update used bytes on the account
    await prisma.driveAccount.update({
      where: { id: accountId },
      data: {
        usedBytes: {
          increment: BigInt(totalSize),
        },
      },
    });

    setUploadProgress(uploadId, {
      bytesUploaded: totalSize,
      totalBytes: totalSize,
      percentage: 100,
      speed: 0,
      status: 'completed',
    });

    return googleDriveId;
  } catch (error) {
    setUploadProgress(uploadId, {
      bytesUploaded: 0,
      totalBytes: totalSize,
      percentage: 0,
      speed: 0,
      status: 'error',
    });
    throw error;
  }
}

/**
 * Split upload a large file across multiple drive accounts.
 */
export async function splitUpload(
  uploadId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  uploadPlan: Array<{ accountId: string; email: string; bytes: bigint }>,
  virtualPath: string = '/',
  userId?: string
): Promise<string> {
  const totalSize = fileBuffer.length;
  const startTime = Date.now();
  let totalUploaded = 0;

  setUploadProgress(uploadId, {
    bytesUploaded: 0,
    totalBytes: totalSize,
    percentage: 0,
    speed: 0,
    status: 'uploading',
    currentChunk: 0,
    totalChunks: uploadPlan.length,
  });

  // Create the parent file record
  const fileRecord = await prisma.fileRecord.create({
    data: {
      userId: userId || null,
      filename,
      sizeBytes: BigInt(totalSize),
      mimeType,
      virtualPath,
      isChunked: true,
      totalChunks: uploadPlan.length,
    },
  });

  let bufferOffset = 0;

  for (let i = 0; i < uploadPlan.length; i++) {
    const plan = uploadPlan[i];
    const chunkSize = Number(plan.bytes);
    const chunkBuffer = fileBuffer.subarray(bufferOffset, bufferOffset + chunkSize);
    const chunkFilename = `${filename}.chunk_${i}_of_${uploadPlan.length}`;

    // Upload this chunk to the designated account
    const chunkUploadUri = await initiateResumableUpload(
      plan.accountId,
      chunkFilename,
      'application/octet-stream',
      chunkSize
    );

    let chunkOffset = 0;
    let chunkDriveId = '';

    while (chunkOffset < chunkSize) {
      const end = Math.min(chunkOffset + CHUNK_SIZE - 1, chunkSize - 1);
      const data = chunkBuffer.subarray(chunkOffset, end + 1);

      const result = await uploadChunkToSession(
        chunkUploadUri,
        data,
        chunkOffset,
        end,
        chunkSize
      );

      chunkOffset = end + 1;
      totalUploaded = bufferOffset + chunkOffset;

      const elapsed = (Date.now() - startTime) / 1000;
      setUploadProgress(uploadId, {
        bytesUploaded: totalUploaded,
        totalBytes: totalSize,
        percentage: Math.round((totalUploaded / totalSize) * 100),
        speed: elapsed > 0 ? Math.round(totalUploaded / elapsed) : 0,
        status: 'uploading',
        currentChunk: i + 1,
        totalChunks: uploadPlan.length,
      });

      if (result.completed && result.fileId) {
        chunkDriveId = result.fileId;
      }
    }

    // Save chunk record
    await prisma.fileChunk.create({
      data: {
        fileRecordId: fileRecord.id,
        chunkIndex: i,
        sizeBytes: BigInt(chunkSize),
        googleDriveId: chunkDriveId,
        driveAccountId: plan.accountId,
      },
    });

    // Update used bytes
    await prisma.driveAccount.update({
      where: { id: plan.accountId },
      data: {
        usedBytes: {
          increment: BigInt(chunkSize),
        },
      },
    });

    bufferOffset += chunkSize;
  }

  setUploadProgress(uploadId, {
    bytesUploaded: totalSize,
    totalBytes: totalSize,
    percentage: 100,
    speed: 0,
    status: 'completed',
    currentChunk: uploadPlan.length,
    totalChunks: uploadPlan.length,
  });

  return fileRecord.id;
}
