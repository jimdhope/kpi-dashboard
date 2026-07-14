import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await authService.getCurrentSession();
    if (!session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, parentId, sortOrder } = body;

    const category = await prisma.kBCategory.update({
      where: { id },
      data: {
        name,
        parentId: parentId !== undefined ? parentId : undefined,
        sortOrder: sortOrder !== undefined ? sortOrder : undefined,
      },
      include: {
        parent: true,
        children: true
      }
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
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

    // Only admins can delete categories
    const isAdmin = await permissionService.hasEffectiveAdminAccess(session.user.roles);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can delete categories' }, { status: 403 });
    }

    const { id } = await params;

    // Move articles to uncategorized before deleting
    await prisma.kBArticle.updateMany({
      where: { categoryId: id },
      data: { categoryId: null }
    });

    await prisma.kBCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
