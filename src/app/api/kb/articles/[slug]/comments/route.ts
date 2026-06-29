import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const comments = await prisma.kBComment.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true }
        },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    // Filter to only top-level comments
    const topLevelComments = comments.filter(c => !c.parentId);

    return NextResponse.json({ comments: topLevelComments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const { content, parentId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const comment = await prisma.kBComment.create({
      data: {
        articleId: article.id,
        content: content.trim(),
        parentId: parentId || null,
        createdById: session.user.id
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        },
        replies: true
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'kb_comment_added',
      title: 'Comment Added',
      description: `Commented on "${article.title}"`,
      metadata: { articleId: article.id, commentId: comment.id }
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json(
      { error: 'Failed to create comment' },
      { status: 500 }
    );
  }
}
