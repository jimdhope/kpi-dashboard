import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
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

    const versions = await prisma.kBVersion.findMany({
      where: { articleId: article.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take,
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    const page = pagedResult(versions, limit, offset);
    return NextResponse.json({ versions: page.items, pagination: page.pagination });
  } catch (error) {
    console.error('Error fetching versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions' },
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

    const article = await prisma.kBArticle.findUnique({ where: { slug } });
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Create a version snapshot of current content
    const version = await prisma.kBVersion.create({
      data: {
        articleId: article.id,
        title: article.title,
        content: article.content as object,
        createdById: session.user.id
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    console.error('Error creating version:', error);
    return NextResponse.json(
      { error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
