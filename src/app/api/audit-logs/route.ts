import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensureDbInitialized } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ logs: [] });
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const logs = await prisma.auditLog.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { action, details, userEmail } = await request.json();
    if (!action || !details) {
      return NextResponse.json({ error: 'Action and details are required' }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: {
        userId: user?.userId || null,
        action,
        details,
        userEmail: userEmail || user?.email || null,
      },
    });
    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Audit log create error:', error);
    return NextResponse.json({ error: 'Failed to record log' }, { status: 500 });
  }
}
