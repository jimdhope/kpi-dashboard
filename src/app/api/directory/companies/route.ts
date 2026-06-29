import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { activityService } from '@/server/services/activity-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    const companies = await prisma.company.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
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
    const { name, type, email, phone, website, address, notes } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const company = await prisma.company.create({
      data: {
        name,
        type: type || 'external',
        email,
        phone,
        website,
        address,
        notes,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    // Log activity
    await activityService.logAgentAction({
      type: 'company_created',
      title: 'Company Added',
      description: `Added company "${name}"`,
      metadata: { companyId: company.id }
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    );
  }
}
