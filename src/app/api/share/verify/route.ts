import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { code, password } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const share = await prisma.sharedLink.findUnique({
      where: { code },
      include: {
        fileRecord: true,
      },
    });

    if (!share) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 });
    }

    // Password validation
    if (share.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: 'Password required' }, { status: 401 });
      }
      const isValid = await bcrypt.compare(password, share.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
      }
    }

    // Increment download count
    await prisma.sharedLink.update({
      where: { id: share.id },
      data: { downloadCount: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      downloadUrl: `/api/download?fileId=${share.fileRecordId}`,
      fileId: share.fileRecordId,
      filename: share.fileRecord.filename,
    });
  } catch (error) {
    console.error('Share verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}

