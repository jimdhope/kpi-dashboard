import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        tags: true,
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

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
    const { name, type, email, phone, website, address, notes, companyName, departmentName, tagNames } = body;

    // Handle tags if provided
    let tagUpdate = undefined;
    if (tagNames && Array.isArray(tagNames)) {
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
        tagUpdate = { set: tagIds.map((tid: string) => ({ id: tid })) };
      }
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        name,
        type,
        email,
        phone,
        website,
        address,
        notes,
        companyName,
        departmentName,
        tags: tagUpdate,
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
      type: 'contact_updated',
      title: 'Contact Updated',
      description: `Updated contact "${name || contact.name}"`,
      metadata: { contactId: contact.id }
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
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

    const contact = await prisma.contact.delete({ where: { id } });

    // Log activity
    await activityService.logAgentAction({
      type: 'contact_deleted',
      title: 'Contact Deleted',
      description: `Deleted contact "${contact.name}"`,
      metadata: { contactId: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact' },
      { status: 500 }
    );
  }
}
