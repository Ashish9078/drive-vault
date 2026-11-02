import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const allFiles = await prisma.fileRecord.findMany({
      where: { isDeleted: false },
      include: {
        driveAccount: {
          select: { displayName: true, email: true },
        },
      },
    });

    // 1. Group by filename and sizeBytes to find duplicates
    const fileMap = new Map<string, typeof allFiles>();

    for (const file of allFiles) {
      const key = `${file.filename.toLowerCase()}__${file.sizeBytes.toString()}`;
      if (!fileMap.has(key)) {
        fileMap.set(key, []);
      }
      fileMap.get(key)!.push(file);
    }

    const duplicateGroups = [];
    let wastedBytes = BigInt(0);

    for (const [, group] of fileMap.entries()) {
      if (group.length > 1) {
        // Group has duplicates
        const sizePerCopy = group[0].sizeBytes;
        const wasted = sizePerCopy * BigInt(group.length - 1);
        wastedBytes += wasted;

        duplicateGroups.push({
          filename: group[0].filename,
          sizeBytes: sizePerCopy.toString(),
          copiesCount: group.length,
          wastedBytes: wasted.toString(),
          files: group.map((f) => ({
            id: f.id,
            filename: f.filename,
            sizeBytes: f.sizeBytes.toString(),
            virtualPath: f.virtualPath,
            driveAccount: f.driveAccount,
            createdAt: f.createdAt,
          })),
        });
      }
    }

    // 2. Large files (top 10 space hogs)
    const largeFiles = [...allFiles]
      .sort((a, b) => (b.sizeBytes > a.sizeBytes ? 1 : -1))
      .slice(0, 10)
      .map((f) => ({
        id: f.id,
        filename: f.filename,
        sizeBytes: f.sizeBytes.toString(),
        virtualPath: f.virtualPath,
        driveAccount: f.driveAccount,
        createdAt: f.createdAt,
      }));

    return NextResponse.json({
      totalScanned: allFiles.length,
      duplicateGroupsCount: duplicateGroups.length,
      wastedBytes: wastedBytes.toString(),
      duplicateGroups,
      largeFiles,
    });
  } catch (error) {
    console.error('Storage analytics error:', error);
    return NextResponse.json({ error: 'Failed to analyze storage' }, { status: 500 });
  }
}

