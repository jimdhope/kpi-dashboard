import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { content, resolved } = body;

    const comment = await prisma.kBComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the author or admin can edit
    if (comment.createdById !== session.user.id && !session.user.roles?.includes('admin')) {
      return NextResponse.json({ error: 'Not authorized to edit this comment' }, { status: 403 });
    }

    const updated = await prisma.kBComment.update({
      where: { id },
      data: {
        content: content !== undefined ? content : undefined,
        resolved: resolved !== undefined ? resolved : undefined,
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ comment: updated });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const comment = await prisma.kBComment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Only the author or admin can delete
    if (comment.createdById !== session.user.id && !session.user.roles?.includes('admin')) {
      return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 });
    }

    await prisma.kBComment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
