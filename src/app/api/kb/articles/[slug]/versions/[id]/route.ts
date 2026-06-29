import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug, id } = await params;

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const version = await prisma.kBVersion.findUnique({ where: { id } });
    if (!version || version.articleId !== article.id) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Create a backup of current state before restoring
    await prisma.kBVersion.create({
      data: {
        articleId: article.id,
        title: article.title,
        content: article.content as object,
        createdById: session.user.id
      }
    });

    // Restore the version
    const restored = await prisma.kBArticle.update({
      where: { id: article.id },
      data: {
        title: version.title,
        content: version.content as object,
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'kb_article_restored',
      title: 'Article Restored',
      description: `Restored article "${article.title}" to version from ${new Date(version.createdAt).toLocaleDateString()}`,
      metadata: { articleId: article.id, versionId: id }
    });

    return NextResponse.json({ article: restored });
  } catch (error) {
    console.error('Error restoring version:', error);
    return NextResponse.json(
      { error: 'Failed to restore version' },
      { status: 500 }
    );
  }
}
