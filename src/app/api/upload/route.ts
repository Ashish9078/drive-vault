import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import {
  findBestDriveAccount,
  findAccountsForSplitUpload,
  resumableUpload,
  splitUpload,
  initiateResumableUpload,
  getUploadProgress,
} from '@/lib/upload';
import { getCurrentUser } from '@/lib/auth';

export const maxDuration = 1800; // 30 minutes for large file uploads

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Please login to upload files' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // Handle Direct Upload Protocol (bypasses server payload & timeout limits)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { action } = body;

      if (action === 'initiate') {
        const { filename, fileSize, mimeType, virtualPath } = body;
        const sizeBigInt = BigInt(fileSize || 0);

        const bestAccount = await findBestDriveAccount(sizeBigInt, user.userId);
        if (!bestAccount) {
          return NextResponse.json({
            mode: 'form_fallback',
            message: 'No single drive account has sufficient space; falling back to split upload',
          });
        }

        // Handle demo account
        if (bestAccount.encryptedAccessToken === 'demo_token' || bestAccount.email.includes('demo')) {
          return NextResponse.json({
            mode: 'demo',
            accountId: bestAccount.id,
            uploadId: uuidv4(),
            filename,
            virtualPath: virtualPath || '/',
          });
        }

        // Initiate direct resumable session on Google Drive
        const origin = request.headers.get('origin') || undefined;
        const uploadId = uuidv4();
        const uploadUri = await initiateResumableUpload(
          bestAccount.id,
          filename,
          mimeType || 'application/octet-stream',
          Number(fileSize),
          origin
        );

        return NextResponse.json({
          mode: 'direct',
          uploadUri,
          uploadId,
          accountId: bestAccount.id,
          targetAccount: bestAccount.email,
          filename,
          virtualPath: virtualPath || '/',
        });
      }

      if (action === 'complete') {
        const { uploadId, googleDriveId, filename, fileSize, mimeType, virtualPath, accountId } = body;

        const fileRecord = await prisma.fileRecord.create({
          data: {
            userId: user.userId,
            filename,
            sizeBytes: BigInt(fileSize),
            mimeType: mimeType || 'application/octet-stream',
            virtualPath: virtualPath || '/',
            googleDriveId,
            driveAccountId: accountId,
            isChunked: false,
          },
        });

        await prisma.driveAccount.update({
          where: { id: accountId },
          data: {
            usedBytes: { increment: BigInt(fileSize) },
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.userId,
            action: 'upload',
            details: `Uploaded ${filename} (${(Number(fileSize) / (1024 * 1024)).toFixed(2)} MB) to ${virtualPath || '/'}`,
            userEmail: user.email,
          },
        });

        return NextResponse.json({
          success: true,
          uploadId,
          fileId: fileRecord.id,
          googleDriveId,
        });
      }
    }

    // Traditional FormData upload (fallback or standard upload)
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const uploadId = uuidv4();
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const mimeType = file.type || 'application/octet-stream';
    const fileSize = BigInt(fileBuffer.length);
    const virtualPath = (formData.get('virtualPath') as string) || '/';

    // Try to find a single account belonging to this user with enough space
    const bestAccount = await findBestDriveAccount(fileSize, user.userId);

    if (bestAccount) {
      // Single account upload
      const googleDriveId = await resumableUpload(
        uploadId,
        bestAccount.id,
        fileBuffer,
        filename,
        mimeType,
        virtualPath,
        user.userId
      );

      return NextResponse.json({
        success: true,
        uploadId,
        googleDriveId,
        mode: 'single',
        targetAccount: bestAccount.email,
        virtualPath,
      });
    } else {
      // Need to split across multiple accounts of this user
      const plan = await findAccountsForSplitUpload(fileSize, user.userId);

      const fileRecordId = await splitUpload(
        uploadId,
        fileBuffer,
        filename,
        mimeType,
        plan,
        virtualPath,
        user.userId
      );

      return NextResponse.json({
        success: true,
        uploadId,
        fileRecordId,
        mode: 'split',
        chunks: plan.map(p => ({
          account: p.email,
          bytes: p.bytes.toString(),
        })),
      });
    }
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const uploadId = request.nextUrl.searchParams.get('uploadId');

  if (!uploadId) {
    return NextResponse.json(
      { error: 'uploadId parameter is required' },
      { status: 400 }
    );
  }

  const progress = getUploadProgress(uploadId);

  if (!progress) {
    return NextResponse.json(
      { error: 'Upload not found or expired' },
      { status: 404 }
    );
  }

  return NextResponse.json(progress);
}
