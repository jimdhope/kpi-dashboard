import { NextResponse } from 'next/server';
import { dataImportService } from '@/server/services/data-import-service';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';

export async function GET() {
  try {
    let user;
    try {
      user = await authService.requireCurrentUser();
    } catch {
      return NextResponse.json({
        error: 'Unauthorized - you need to be logged in as admin',
      }, { status: 401 });
    }
    
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const status = await dataImportService.getImportStatus();
    const logs = await dataImportService.getImportLogs(10);

    return NextResponse.json({ status, logs });
  } catch (error) {
    console.error('[status] Failed to load import status:', error);
    return NextResponse.json(
      { error: 'Failed to load import status' },
      { status: 500 }
    );
  }
}
