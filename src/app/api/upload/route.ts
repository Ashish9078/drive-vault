import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  findBestDriveAccount,
  findAccountsForSplitUpload,
  resumableUpload,
  splitUpload,
  getUploadProgress,
} from '@/lib/upload';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
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

    // Try to find a single account with enough space
    const bestAccount = await findBestDriveAccount(fileSize);

    if (bestAccount) {
      // Single account upload
      const googleDriveId = await resumableUpload(
        uploadId,
        bestAccount.id,
        fileBuffer,
        filename,
        mimeType,
        virtualPath
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
      // Need to split across multiple accounts
      const plan = await findAccountsForSplitUpload(fileSize);

      const fileRecordId = await splitUpload(
        uploadId,
        fileBuffer,
        filename,
        mimeType,
        plan,
        virtualPath
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
      { error: 'uploadId is required' },
      { status: 400 }
    );
  }

  const progress = getUploadProgress(uploadId);

  if (!progress) {
    return NextResponse.json(
      { error: 'Upload not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(progress);
}
