import { google, drive_v3 } from 'googleapis';
import prisma from './prisma';
import { encrypt, decrypt } from './encryption';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(state?: string): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state || '',
  });
}

/**
 * Get an authenticated OAuth2 client for a specific drive account.
 * Automatically refreshes tokens if expired.
 */
export async function getAuthenticatedClient(accountId: string) {
  const account = await prisma.driveAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Drive account ${accountId} not found`);
  }

  const oauth2Client = getOAuth2Client();
  const accessToken = decrypt(account.encryptedAccessToken);
  const refreshToken = decrypt(account.encryptedRefreshToken);

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt.getTime(),
  });

  // Check if token needs refresh (within 5 minutes of expiry)
  const now = Date.now();
  const expiresAt = account.tokenExpiresAt.getTime();

  if (now >= expiresAt - 5 * 60 * 1000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored tokens
      await prisma.driveAccount.update({
        where: { id: accountId },
        data: {
          encryptedAccessToken: encrypt(credentials.access_token || ''),
          encryptedRefreshToken: credentials.refresh_token 
            ? encrypt(credentials.refresh_token) 
            : account.encryptedRefreshToken,
          tokenExpiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
          status: 'active',
        },
      });

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      // Mark account as needing reauth
      await prisma.driveAccount.update({
        where: { id: accountId },
        data: { status: 'needs_reauth' },
      });
      throw new Error(`Token refresh failed for ${account.email}. Please re-authenticate.`);
    }
  }

  return { oauth2Client, account };
}

/**
 * Get Google Drive client for a specific account.
 */
export async function getDriveClient(accountId: string): Promise<drive_v3.Drive> {
  const { oauth2Client } = await getAuthenticatedClient(accountId);
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Get storage quota for a specific drive account.
 */
export async function getDriveStorageInfo(accountId: string) {
  const drive = await getDriveClient(accountId);
  const response = await drive.about.get({ fields: 'storageQuota,user' });
  
  const quota = response.data.storageQuota;
  return {
    totalBytes: BigInt(quota?.limit || '16106127360'),
    usedBytes: BigInt(quota?.usage || '0'),
    email: response.data.user?.emailAddress || '',
    displayName: response.data.user?.displayName || '',
    profilePicture: response.data.user?.photoLink || '',
  };
}

/**
 * Fetch files from a drive account and sync to local database.
 */
export async function syncDriveFiles(accountId: string) {
  const account = await prisma.driveAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Drive account ${accountId} not found`);

  // If demo account, mark as synced successfully without hitting real Google API
  if (account.encryptedAccessToken === 'demo_token' || account.email.includes('demo')) {
    await prisma.driveAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        status: 'active',
      },
    });
    return { success: true, fileCount: 0, message: 'Demo drive synced' };
  }

  const drive = await getDriveClient(accountId);
  
  // Update account status
  await prisma.driveAccount.update({
    where: { id: accountId },
    data: { status: 'syncing' },
  });

  try {
    // Update storage info
    const storageInfo = await getDriveStorageInfo(accountId);
    await prisma.driveAccount.update({
      where: { id: accountId },
      data: {
        totalBytes: storageInfo.totalBytes,
        usedBytes: storageInfo.usedBytes,
        displayName: storageInfo.displayName,
        profilePicture: storageInfo.profilePicture,
      },
    });

    // Fetch all files
    let pageToken: string | undefined;
    const allFiles: drive_v3.Schema$File[] = [];

    do {
      const response = await drive.files.list({
        pageSize: 1000,
        fields: 'nextPageToken, files(id, name, size, mimeType, createdTime, parents)',
        pageToken,
        q: "trashed = false",
      });

      if (response.data.files) {
        allFiles.push(...response.data.files);
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    // Clear existing non-chunked records for this account and repopulate
    await prisma.fileRecord.deleteMany({
      where: { 
        driveAccountId: accountId,
        isChunked: false,
      },
    });

    // Fast batch insert existing files using createMany
    const recordsToInsert = allFiles
      .filter(file => file.mimeType !== 'application/vnd.google-apps.folder')
      .map(file => ({
        userId: account.userId || null,
        filename: file.name || 'Untitled',
        sizeBytes: BigInt(file.size || '0'),
        mimeType: file.mimeType || 'application/octet-stream',
        virtualPath: '/',
        googleDriveId: file.id || null,
        driveAccountId: accountId,
        isChunked: false,
      }));

    if (recordsToInsert.length > 0) {
      await prisma.fileRecord.createMany({
        data: recordsToInsert,
      });
    }

    // Update sync timestamp and status
    await prisma.driveAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        status: 'active',
      },
    });

    return { success: true, fileCount: allFiles.length };
  } catch (error) {
    await prisma.driveAccount.update({
      where: { id: accountId },
      data: { status: 'error' },
    });
    throw error;
  }
}

/**
 * Exponential backoff with jitter for API rate limiting.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { code?: number; response?: { status?: number } };
      const statusCode = err.code || err.response?.status;
      
      if (attempt === maxRetries) throw error;
      
      // Only retry on rate limit (429) or server errors (5xx)
      if (statusCode !== 429 && (statusCode === undefined || statusCode < 500)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry exhausted');
}
