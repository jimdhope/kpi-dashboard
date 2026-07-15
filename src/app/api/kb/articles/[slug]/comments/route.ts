import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';
import { pageParams, pagedResult } from '@/server/http-pagination';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { limit, offset, take } = pageParams(request.nextUrl.searchParams, { defaultLimit: 100, maxLimit: 200 });

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const comments = await prisma.kBComment.findMany({
      where: { articleId: article.id, parentId: null },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take,
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

    const page = pagedResult(comments, limit, offset);
    return NextResponse.json({ comments: page.items, pagination: page.pagination });
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
