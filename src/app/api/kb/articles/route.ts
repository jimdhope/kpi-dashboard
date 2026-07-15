import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';
import { pageParams, pagedResult } from '@/server/http-pagination';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId');
    const status = searchParams.get('status') || 'published';
    const tagId = searchParams.get('tagId');
    const { limit, offset, take } = pageParams(searchParams, { defaultLimit: 200, maxLimit: 500 });

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
    }

    if (tagId) {
      where.tags = {
        some: { id: tagId }
      };
    }

    const articles = await prisma.kBArticle.findMany({
      where,
      include: {
        category: true,
        tags: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { comments: true, versions: true }
        }
      },
      orderBy: { title: 'asc' },
      skip: offset,
      take,
    });

    const page = pagedResult(articles, limit, offset);
    return NextResponse.json({ articles: page.items, pagination: page.pagination });
  } catch (error) {
    console.error('Error fetching KB articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, excerpt, categoryName, categoryId: incomingCategoryId, tagNames, tagIds, status } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    let slug = generateSlug(title);
    const existingSlug = await prisma.kBArticle.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    // Handle category - use incomingCategoryId if provided, otherwise fallback to categoryName
    let finalCategoryId = incomingCategoryId || null;
    if (!finalCategoryId && categoryName) {
      const existingCategory = await prisma.kBCategory.findFirst({
        where: { name: { equals: categoryName, mode: 'insensitive' } }
      });
      if (existingCategory) {
        finalCategoryId = existingCategory.id;
      } else {
        const newCategory = await prisma.kBCategory.create({
          data: { 
            name: categoryName,
            slug: generateSlug(categoryName)
          }
        });
        finalCategoryId = newCategory.id;
      }
    }

    // Handle tags - use tagIds if provided, otherwise fallback to creating from tagNames
    let tagConnect = undefined;
    if (tagIds && tagIds.length > 0) {
      tagConnect = { connect: tagIds.map((id: string) => ({ id })) };
    } else if (tagNames && tagNames.length > 0) {
      const newTagIds: string[] = [];
      for (const tagName of tagNames) {
        const existingTag = await prisma.tag.findFirst({
          where: { name: { equals: tagName, mode: 'insensitive' } }
        });
        if (existingTag) {
          newTagIds.push(existingTag.id);
        } else {
          const newTag = await prisma.tag.create({
            data: { name: tagName, color: '#6366f1' }
          });
          newTagIds.push(newTag.id);
        }
      }
      if (newTagIds.length > 0) {
        tagConnect = { connect: newTagIds.map((id: string) => ({ id })) };
      }
    }

    const article = await prisma.kBArticle.create({
      data: {
        title,
        slug,
        content: content || {},
        excerpt,
        categoryId: finalCategoryId,
        status: status || 'draft',
        createdById: session.user.id,
        publishedAt: status === 'published' ? new Date() : null,
        tags: tagConnect,
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
      type: 'kb_article_created',
      title: 'Article Created',
      description: `Created article "${title}"`,
      metadata: { articleId: article.id, slug: article.slug }
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    console.error('Error creating KB article:', error);
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}
