import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const types = searchParams.get('types')?.split(',') || ['kb', 'contacts', 'pages'];

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: any[] = [];

    // Search Knowledge Base articles
    if (types.includes('kb')) {
      const articles = await prisma.kBArticle.findMany({
        where: {
          status: 'published',
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { excerpt: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          updatedAt: true,
        },
        take: 5,
        orderBy: { updatedAt: 'desc' }
      });

      results.push(...articles.map(a => ({
        type: 'kb',
        id: a.id,
        title: a.title,
        href: `/knowledge-base/${a.slug}`,
        subtitle: a.excerpt || undefined,
      })));
    }

    // Search Contacts
    if (types.includes('contacts')) {
      const contacts = await prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          companyName: true,
        },
        take: 5,
        orderBy: { name: 'asc' }
      });

      results.push(...contacts.map(c => ({
        type: 'contact',
        id: c.id,
        title: c.name,
        href: `/directory/contacts/${c.id}`,
        subtitle: c.email || c.companyName || c.type,
      })));
    }

    // Search Companies
    if (types.includes('contacts')) {
      const companies = await prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          type: true,
        },
        take: 3,
        orderBy: { name: 'asc' }
      });

      results.push(...companies.map(c => ({
        type: 'company',
        id: c.id,
        title: c.name,
        href: `/directory/companies`,
        subtitle: c.type,
      })));
    }

    // Search Users
    if (types.includes('users')) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          pod: { select: { name: true } },
        },
        take: 5,
        orderBy: { name: 'asc' }
      });

      results.push(...users.map(u => ({
        type: 'user',
        id: u.id,
        title: u.name,
        href: `/settings/users`,
        subtitle: u.email || u.pod?.name || 'User',
      })));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
