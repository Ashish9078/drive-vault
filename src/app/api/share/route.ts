import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const share = await prisma.sharedLink.findUnique({
      where: { code },
      include: {
        fileRecord: {
          select: {
            id: true,
            filename: true,
            sizeBytes: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!share) {
      return NextResponse.json({ error: 'Share link not found or expired' }, { status: 404 });
    }

    // Check expiry
    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    return NextResponse.json({
      code: share.code,
      fileId: share.fileRecord.id,
      filename: share.fileRecord.filename,
      sizeBytes: share.fileRecord.sizeBytes.toString(),
      mimeType: share.fileRecord.mimeType,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      isPasswordProtected: !!share.passwordHash,
    });
  } catch (error) {
    console.error('Share GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId, password, expiresInHours } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const file = await prisma.fileRecord.findFirst({
      where: { id: fileId, userId: user.userId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const code = crypto.randomBytes(6).toString('base64url');
    let passwordHash: string | null = null;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    let expiresAt: Date | null = null;
    if (expiresInHours && Number(expiresInHours) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInHours) * 3600 * 1000);
    }

    const share = await prisma.sharedLink.create({
      data: {
        code,
        fileRecordId: fileId,
        passwordHash,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      code: share.code,
      url: `/share/${share.code}`,
      expiresAt: share.expiresAt,
      isPasswordProtected: !!passwordHash,
    });
  } catch (error) {
    console.error('Share POST error:', error);
    return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
  }
}
