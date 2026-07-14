import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';
import { activityService } from '@/server/services/activity-service';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const article = await prisma.kBArticle.findUnique({
      where: { slug },
      include: {
        category: true,
        tags: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            createdBy: {
              select: { id: true, name: true }
            }
          }
        },
        comments: {
          where: { parentId: null },
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
        },
        _count: {
          select: { comments: true, versions: true }
        }
      }
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Increment view count
    await prisma.kBArticle.update({
      where: { id: article.id },
      data: { views: { increment: 1 } }
    });

    return NextResponse.json({ article });
  } catch (error) {
    console.error('Error fetching KB article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { title, content, excerpt, categoryId, tagIds, status, locked, lockedRoles, createVersion } = body;

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check if user can edit (lock check)
    const isAdmin = await permissionService.hasEffectiveAdminAccess(session.user.roles);
    if (article.locked && isAdmin) {
      // Admins can always edit
    } else if (article.locked && lockedRoles?.length) {
      const userRole = session.user.roles?.[0];
      if (userRole && lockedRoles.includes(userRole)) {
        return NextResponse.json(
          { error: 'This article is locked for your role' },
          { status: 403 }
        );
      }
    }

    // Create version snapshot if requested
    if (createVersion) {
      await prisma.kBVersion.create({
        data: {
          articleId: article.id,
          title: article.title,
          content: article.content as object,
          createdById: session.user.id
        }
      });
    }

    // Update article
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (locked !== undefined) updateData.locked = locked;
    if (lockedRoles !== undefined) updateData.lockedRoles = lockedRoles;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'published' && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.kBArticle.update({
      where: { id: article.id },
      data: {
        ...updateData,
        tags: tagIds ? { set: tagIds.map((id: string) => ({ id })) } : undefined,
      },
      include: {
        category: true,
        tags: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'kb_article_updated',
      title: 'Article Updated',
      description: `Updated article "${title || article.title}"`,
      metadata: { articleId: article.id, slug: article.slug }
    });

    return NextResponse.json({ article: updated });
  } catch (error) {
    console.error('Error updating KB article:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can delete
    const isAdminDel = await permissionService.hasEffectiveAdminAccess(session.user.roles);
    if (!isAdminDel) {
      return NextResponse.json({ error: 'Only admins can delete articles' }, { status: 403 });
    }

    const { slug } = await params;

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await prisma.kBArticle.delete({ where: { id: article.id } });

    // Log activity
    await activityService.logAgentAction({
      type: 'kb_article_deleted',
      title: 'Article Deleted',
      description: `Deleted article "${article.title}"`,
      metadata: { articleId: article.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting KB article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
