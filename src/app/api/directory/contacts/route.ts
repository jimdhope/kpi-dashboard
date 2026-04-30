import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type');
    const companyName = searchParams.get('company');
    const departmentName = searchParams.get('department');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { website: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { departmentName: { contains: search, mode: 'insensitive' } },
        { tags: { some: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (companyName) {
      where.companyName = { contains: companyName, mode: 'insensitive' };
    }

    if (departmentName) {
      where.departmentName = { contains: departmentName, mode: 'insensitive' };
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        tags: true,
        createdBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
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
    const { name, type, email, phone, website, address, notes, company, department, tagNames } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Handle tags - create if they don't exist
    let tagConnect = undefined;
    if (tagNames && tagNames.length > 0) {
      const tagIds: string[] = [];
      for (const tagName of tagNames) {
        const existingTag = await prisma.tag.findFirst({
          where: { name: { equals: tagName, mode: 'insensitive' } }
        });
        if (existingTag) {
          tagIds.push(existingTag.id);
        } else {
          const newTag = await prisma.tag.create({
            data: { name: tagName, color: '#6366f1' }
          });
          tagIds.push(newTag.id);
        }
      }
      if (tagIds.length > 0) {
        tagConnect = { connect: tagIds.map((id: string) => ({ id })) };
      }
    }

    const contact = await prisma.contact.create({
      data: {
        name,
        type: type || 'person',
        email,
        phone,
        website,
        address,
        notes,
        companyName: company || null,
        departmentName: department || null,
        createdById: session.user.id,
        tags: tagConnect,
      },
      include: {
        tags: true,
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'contact_created',
      title: 'Contact Added',
      description: `Added contact "${name}"`,
      metadata: { contactId: contact.id }
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error('Error creating contact:', error);
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    );
  }
}
