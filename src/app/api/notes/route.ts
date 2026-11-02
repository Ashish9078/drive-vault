import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driveAccountId = searchParams.get('driveAccountId');
    const category = searchParams.get('category');
    const q = searchParams.get('q');

    const where: Record<string, unknown> = {};

    if (driveAccountId) {
      where.driveAccountId = driveAccountId;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { content: { contains: q } },
        { tags: { contains: q } },
        { driveLetter: { contains: q } },
      ];
    }

    const notes = await prisma.driveNote.findMany({
      where,
      orderBy: [
        { isPinned: 'desc' },
        { updatedAt: 'desc' },
      ],
      include: {
        driveAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      content,
      category = 'reminder',
      driveLetter = null,
      driveAccountId = null,
      color = 'amber',
      isPinned = false,
      tags = '',
    } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      );
    }

    const note = await prisma.driveNote.create({
      data: {
        title,
        content,
        category,
        driveLetter,
        driveAccountId: driveAccountId || null,
        color,
        isPinned: Boolean(isPinned),
        tags: tags || '',
      },
      include: {
        driveAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Failed to create note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Note id is required' },
        { status: 400 }
      );
    }

    const note = await prisma.driveNote.update({
      where: { id },
      data: updates,
      include: {
        driveAccount: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Failed to update note:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Note id is required' },
        { status: 400 }
      );
    }

    await prisma.driveNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
