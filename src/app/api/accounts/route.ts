import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensureDbInitialized } from '@/lib/prisma';

// Serialize BigInt values to strings for JSON
function serializeAccount(account: Record<string, unknown>) {
  return {
    ...account,
    totalBytes: account.totalBytes?.toString(),
    usedBytes: account.usedBytes?.toString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const accounts = await prisma.driveAccount.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const serialized = accounts.map(a => serializeAccount(a as unknown as Record<string, unknown>));

    // Compute aggregated stats
    const totalPool = accounts.reduce((sum, a) => sum + a.totalBytes, BigInt(0));
    const totalUsed = accounts.reduce((sum, a) => sum + a.usedBytes, BigInt(0));

    return NextResponse.json({
      accounts: serialized,
      stats: {
        totalPool: totalPool.toString(),
        totalUsed: totalUsed.toString(),
        totalFree: (totalPool - totalUsed).toString(),
        accountCount: accounts.length,
        percentUsed: totalPool > BigInt(0)
          ? Number((totalUsed * BigInt(10000)) / totalPool) / 100
          : 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    // Delete associated file chunks first
    await prisma.fileChunk.deleteMany({
      where: { driveAccountId: accountId },
    });

    // Delete file records
    await prisma.fileRecord.deleteMany({
      where: { driveAccountId: accountId },
    });

    // Delete the account
    await prisma.driveAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'clear_demo') {
      const demoAccounts = await prisma.driveAccount.findMany({
        where: { email: { contains: 'demo' } },
      });
      for (const a of demoAccounts) {
        await prisma.fileChunk.deleteMany({ where: { driveAccountId: a.id } });
        await prisma.fileRecord.deleteMany({ where: { driveAccountId: a.id } });
        await prisma.driveAccount.delete({ where: { id: a.id } });
      }
      return NextResponse.json({ success: true, message: 'Demo accounts cleared' });
    }

    if (action === 'seed_demo') {
      const DEMO_ACCOUNTS = [
        {
          email: 'demo.personal@gmail.com',
          displayName: 'Personal Drive (Primary)',
          usedBytes: BigInt(3435973836), // ~3.2 GB
          status: 'active',
        },
        {
          email: 'demo.work@gmail.com',
          displayName: 'Work & Code Projects',
          usedBytes: BigInt(6227702579), // ~5.8 GB
          status: 'active',
        },
        {
          email: 'demo.media@gmail.com',
          displayName: 'Media Vault 4K',
          usedBytes: BigInt(12240656793), // ~11.4 GB
          status: 'active',
        },
        {
          email: 'demo.backup@gmail.com',
          displayName: 'System Backups',
          usedBytes: BigInt(2254857830), // ~2.1 GB
          status: 'active',
        },
        {
          email: 'demo.datasets@gmail.com',
          displayName: 'AI Model Weights & Data',
          usedBytes: BigInt(9019431321), // ~8.4 GB
          status: 'active',
        },
        {
          email: 'demo.photos@gmail.com',
          displayName: 'Photography RAW Archives',
          usedBytes: BigInt(7194070220), // ~6.7 GB
          status: 'active',
        },
        {
          email: 'demo.videos@gmail.com',
          displayName: 'Video Production Bin',
          usedBytes: BigInt(14495514624), // ~13.5 GB (Windows high capacity alert)
          status: 'active',
        },
        {
          email: 'demo.shared@gmail.com',
          displayName: 'Team Shared Space',
          usedBytes: BigInt(4617089843), // ~4.3 GB
          status: 'active',
        },
        {
          email: 'demo.research@gmail.com',
          displayName: 'Research Papers & Books',
          usedBytes: BigInt(1932735283), // ~1.8 GB
          status: 'active',
        },
        {
          email: 'demo.cold@gmail.com',
          displayName: 'Cold Storage Vault',
          usedBytes: BigInt(966367641), // ~0.9 GB
          status: 'active',
        },
      ];

      const TOTAL_15GB = BigInt(16106127360);
      const createdAccounts = [];

      for (const item of DEMO_ACCOUNTS) {
        const existing = await prisma.driveAccount.findUnique({
          where: { email: item.email },
        });

        if (!existing) {
          const acc = await prisma.driveAccount.create({
            data: {
              email: item.email,
              displayName: item.displayName,
              profilePicture: '',
              encryptedAccessToken: 'demo_token',
              encryptedRefreshToken: 'demo_refresh',
              tokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
              totalBytes: TOTAL_15GB,
              usedBytes: item.usedBytes,
              status: item.status,
              lastSyncAt: new Date(),
            },
          });
          createdAccounts.push(acc);
        }
      }

      // Add sample files if files table is empty
      const fileCount = await prisma.fileRecord.count();
      if (fileCount === 0 && createdAccounts.length > 0) {
        const sampleFiles = [
          {
            filename: 'Project_Quantum_Source.tar.gz',
            sizeBytes: BigInt(1572864000), // 1.5 GB
            mimeType: 'application/gzip',
            virtualPath: '/Development',
            driveAccountId: createdAccounts[0]?.id,
          },
          {
            filename: 'Enterprise_Architecture_2026.pdf',
            sizeBytes: BigInt(47185920), // 45 MB
            mimeType: 'application/pdf',
            virtualPath: '/Documents',
            driveAccountId: createdAccounts[1]?.id,
          },
          {
            filename: 'Nature_Cinematics_4K_60FPS.mp4',
            sizeBytes: BigInt(8589934592), // 8 GB
            mimeType: 'video/mp4',
            virtualPath: '/Videos',
            driveAccountId: createdAccounts[2]?.id,
            isChunked: true,
            totalChunks: 3,
          },
          {
            filename: 'Database_Full_Dump_Oct.sql',
            sizeBytes: BigInt(2147483648), // 2 GB
            mimeType: 'application/sql',
            virtualPath: '/Backups',
            driveAccountId: createdAccounts[3]?.id,
          },
          {
            filename: 'Llama3_FineTuned_Weights.safetensors',
            sizeBytes: BigInt(5368709120), // 5 GB
            mimeType: 'application/octet-stream',
            virtualPath: '/AI-Models',
            driveAccountId: createdAccounts[4]?.id,
          },
          {
            filename: 'Portrait_Session_Studio_RAW.zip',
            sizeBytes: BigInt(3758096384), // 3.5 GB
            mimeType: 'application/zip',
            virtualPath: '/Photography',
            driveAccountId: createdAccounts[5]?.id,
          },
          {
            filename: 'Podcast_Episode_Master_Audio.wav',
            sizeBytes: BigInt(681574400), // 650 MB
            mimeType: 'audio/wav',
            virtualPath: '/Audio',
            driveAccountId: createdAccounts[7]?.id,
          },
        ];

        for (const file of sampleFiles) {
          if (file.driveAccountId) {
            await prisma.fileRecord.create({
              data: {
                filename: file.filename,
                sizeBytes: file.sizeBytes,
                mimeType: file.mimeType,
                virtualPath: file.virtualPath,
                googleDriveId: 'demo_gdrive_id_' + Math.random().toString(36).substring(7),
                isChunked: file.isChunked || false,
                totalChunks: file.totalChunks || 0,
                driveAccountId: file.driveAccountId,
              },
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: '10 Google Drives mounted with 150GB pooled virtual capacity.',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to process accounts POST:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
