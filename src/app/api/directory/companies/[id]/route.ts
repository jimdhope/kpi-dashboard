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

    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    console.error('Error fetching company:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company' },
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
    const { name, type, email, phone, website, address, notes } = body;

    const company = await prisma.company.update({
      where: { id },
      data: {
        name,
        type,
        email,
        phone,
        website,
        address,
        notes,
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'company_updated',
      title: 'Company Updated',
      description: `Updated company "${name || company.name}"`,
      metadata: { companyId: company.id }
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { error: 'Failed to update company' },
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

    const company = await prisma.company.delete({ where: { id } });

    // Log activity
    await activityService.logAgentAction({
      type: 'company_deleted',
      title: 'Company Deleted',
      description: `Deleted company "${company.name}"`,
      metadata: { companyId: id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting company:', error);
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    );
  }
}
