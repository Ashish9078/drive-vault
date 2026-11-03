import { NextRequest, NextResponse } from 'next/server';
import prisma, { ensureDbInitialized } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    await ensureDbInitialized();
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const logs = await prisma.auditLog.findMany({
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
    const { action, details, userEmail } = await request.json();
    if (!action || !details) {
      return NextResponse.json({ error: 'Action and details are required' }, { status: 400 });
    }

    const log = await prisma.auditLog.create({
      data: { action, details, userEmail },
    });
    return NextResponse.json({ success: true, log });
  } catch (error) {
    console.error('Audit log create error:', error);
    return NextResponse.json({ error: 'Failed to record log' }, { status: 500 });
  }
}

