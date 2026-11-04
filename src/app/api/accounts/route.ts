import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensureDbInitialized } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        accounts: [],
        stats: {
          totalPool: '0',
          totalUsed: '0',
          totalFree: '0',
          accountCount: 0,
          percentUsed: 0,
        },
      });
    }

    const accounts = await prisma.driveAccount.findMany({
      where: { userId: user.userId },
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = await request.json();
    if (!accountId) {
      return NextResponse.json(
        { error: 'accountId is required' },
        { status: 400 }
      );
    }

    const account = await prisma.driveAccount.findFirst({
      where: { id: accountId, userId: user.userId },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await request.json();

    if (action === 'clear_demo') {
      const demoAccounts = await prisma.driveAccount.findMany({
        where: { userId: user.userId, email: { contains: 'demo' } },
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
          email: `demo.personal.${user.userId.substring(0, 5)}@gmail.com`,
          displayName: 'Personal Drive (Primary)',
          usedBytes: BigInt(3435973836), // ~3.2 GB
          status: 'active',
        },
        {
          email: `demo.work.${user.userId.substring(0, 5)}@gmail.com`,
          displayName: 'Work & Code Projects',
          usedBytes: BigInt(6227702579), // ~5.8 GB
          status: 'active',
        },
        {
          email: `demo.media.${user.userId.substring(0, 5)}@gmail.com`,
          displayName: 'Media Vault 4K',
          usedBytes: BigInt(12240656793), // ~11.4 GB
          status: 'active',
        },
      ];

      const TOTAL_15GB = BigInt(16106127360);
      const createdAccounts = [];

      for (const item of DEMO_ACCOUNTS) {
        const existing = await prisma.driveAccount.findFirst({
          where: { userId: user.userId, email: item.email },
        });

        if (!existing) {
          const acc = await prisma.driveAccount.create({
            data: {
              userId: user.userId,
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

      return NextResponse.json({
        success: true,
        message: 'Demo accounts loaded for this workspace.',
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
