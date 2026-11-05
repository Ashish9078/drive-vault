import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensureDbInitialized } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

function serializeFile(file: Record<string, unknown>) {
  return {
    ...file,
    sizeBytes: file.sizeBytes?.toString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        files: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
        },
      });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const path = searchParams.get('path');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const accountId = searchParams.get('accountId') || '';
    const trash = searchParams.get('trash') === 'true';
    const starred = searchParams.get('starred') === 'true';

    const where: Record<string, unknown> = {
      userId: user.userId,
      isDeleted: trash ? true : false,
    };

    if (starred) {
      where.isStarred = true;
    }

    if (query) {
      where.filename = { contains: query };
    }

    if (path && path !== 'ALL') {
      where.virtualPath = path;
    }

    if (accountId) {
      where.OR = [
        { driveAccountId: accountId },
        { chunks: { some: { driveAccountId: accountId } } },
      ];
    }

    const validSortFields = ['filename', 'sizeBytes', 'mimeType', 'createdAt'];
    const orderField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [files, total] = await Promise.all([
      prisma.fileRecord.findMany({
        where,
        orderBy: { [orderField]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driveAccount: {
            select: {
              email: true,
              displayName: true,
            },
          },
          chunks: {
            include: {
              driveAccount: {
                select: { email: true },
              },
            },
          },
        },
      }),
      prisma.fileRecord.count({ where }),
    ]);

    const serialized = files.map(f => {
      const serializedFile = serializeFile(f as unknown as Record<string, unknown>);
      return {
        ...serializedFile,
        chunks: f.chunks?.map(c => ({
          ...c,
          sizeBytes: c.sizeBytes.toString(),
        })),
      };
    });

    return NextResponse.json({
      files: serialized,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch files:', error);
    return NextResponse.json(
      { error: 'Failed to fetch files' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId, permanent } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: 'fileId is required' },
        { status: 400 }
      );
    }

    const file = await prisma.fileRecord.findFirst({
      where: { id: fileId, userId: user.userId },
      include: { chunks: true },
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Soft delete if permanent is not true
    if (!permanent) {
      await prisma.fileRecord.update({
        where: { id: fileId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // Also move to Google Drive Trash so Google Drive reflects the deletion
      if (file.googleDriveId && file.driveAccountId) {
        try {
          const { getDriveClient } = await import('@/lib/google-drive');
          const drive = await getDriveClient(file.driveAccountId);
          await drive.files.update({
            fileId: file.googleDriveId,
            requestBody: { trashed: true },
          });
        } catch (driveErr) {
          console.warn('Failed to move to Google Drive trash:', driveErr);
        }
      }

      return NextResponse.json({ success: true, softDeleted: true });
    }

    // Permanent deletion from Google Drive
    if (file.googleDriveId && file.driveAccountId) {
      try {
        const { getDriveClient } = await import('@/lib/google-drive');
        const drive = await getDriveClient(file.driveAccountId);
        try {
          await drive.files.delete({ fileId: file.googleDriveId });
          console.log(`Deleted file ${file.googleDriveId} permanently from Google Drive`);
        } catch (delErr: any) {
          console.warn('drive.files.delete failed, falling back to trashed: true:', delErr?.message);
          await drive.files.update({
            fileId: file.googleDriveId,
            requestBody: { trashed: true },
          });
        }

        // Update used bytes
        const account = await prisma.driveAccount.findUnique({
          where: { id: file.driveAccountId },
        });
        if (account) {
          const newUsed = account.usedBytes > file.sizeBytes ? account.usedBytes - file.sizeBytes : BigInt(0);
          await prisma.driveAccount.update({
            where: { id: file.driveAccountId },
            data: { usedBytes: newUsed },
          });
        }
      } catch (driveError: any) {
        console.error('Failed to delete from Google Drive:', driveError?.response?.data || driveError?.message || driveError);
      }
    }

    // Delete chunks from Google Drive if chunked
    if (file.isChunked && file.chunks.length > 0) {
      for (const chunk of file.chunks) {
        try {
          const { getDriveClient } = await import('@/lib/google-drive');
          const drive = await getDriveClient(chunk.driveAccountId);
          try {
            await drive.files.delete({ fileId: chunk.googleDriveId });
          } catch {
            await drive.files.update({
              fileId: chunk.googleDriveId,
              requestBody: { trashed: true },
            });
          }

          const account = await prisma.driveAccount.findUnique({
            where: { id: chunk.driveAccountId },
          });
          if (account) {
            const newUsed = account.usedBytes > chunk.sizeBytes ? account.usedBytes - chunk.sizeBytes : BigInt(0);
            await prisma.driveAccount.update({
              where: { id: chunk.driveAccountId },
              data: { usedBytes: newUsed },
            });
          }
        } catch (driveError) {
          console.warn('Failed to delete chunk from Google Drive:', driveError);
        }
      }
    }

    // Delete from database
    await prisma.fileChunk.deleteMany({
      where: { fileRecordId: fileId },
    });

    await prisma.fileRecord.delete({
      where: { id: fileId },
    });

    return NextResponse.json({ success: true, permanent: true });
  } catch (error) {
    console.error('Failed to delete file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, fileId, virtualPath, filename, isStarred, tags } = body;

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    const file = await prisma.fileRecord.findFirst({
      where: { id: fileId, userId: user.userId },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (action === 'restore') {
      const updated = await prisma.fileRecord.update({
        where: { id: fileId },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });

      if (file.googleDriveId && file.driveAccountId) {
        try {
          const { getDriveClient } = await import('@/lib/google-drive');
          const drive = await getDriveClient(file.driveAccountId);
          await drive.files.update({
            fileId: file.googleDriveId,
            requestBody: { trashed: false },
          });
        } catch (driveErr) {
          console.warn('Failed to un-trash on Google Drive:', driveErr);
        }
      }

      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          action: 'restore',
          details: `Restored "${updated.filename}" from Recycle Bin`,
        },
      });
      return NextResponse.json({ success: true, message: 'File restored successfully' });
    }

    if (action === 'move') {
      const updated = await prisma.fileRecord.update({
        where: { id: fileId },
        data: {
          virtualPath: virtualPath || '/',
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          action: 'move',
          details: `Moved "${updated.filename}" to folder "${virtualPath || '/'}"`,
        },
      });
      return NextResponse.json({ success: true, message: 'File moved successfully' });
    }

    if (action === 'rename') {
      if (!filename || filename.trim().length === 0) {
        return NextResponse.json({ error: 'New filename is required' }, { status: 400 });
      }
      const updated = await prisma.fileRecord.update({
        where: { id: fileId },
        data: { filename: filename.trim() },
      });
      await prisma.auditLog.create({
        data: {
          userId: user.userId,
          action: 'rename',
          details: `Renamed file to "${filename.trim()}"`,
        },
      });
      return NextResponse.json({ success: true, message: 'File renamed successfully', file: updated });
    }

    if (action === 'star') {
      const updated = await prisma.fileRecord.update({
        where: { id: fileId },
        data: { isStarred: typeof isStarred === 'boolean' ? isStarred : true },
      });
      return NextResponse.json({ success: true, isStarred: updated.isStarred });
    }

    if (action === 'tags') {
      const updated = await prisma.fileRecord.update({
        where: { id: fileId },
        data: { tags: tags || '' },
      });
      return NextResponse.json({ success: true, tags: updated.tags });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('PATCH file error:', error);
    return NextResponse.json({ error: 'Failed to update file' }, { status: 500 });
  }
}
