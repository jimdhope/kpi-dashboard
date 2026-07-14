import { NextRequest, NextResponse } from 'next/server';
import { dataImportService } from '@/server/services/data-import-service';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';

export async function GET(request: NextRequest) {
  try {
    let user;
    try {
      user = await authService.requireCurrentUser();
    } catch (authError: any) {
      return NextResponse.json({ 
        error: 'Unauthorized - you need to be logged in as admin',
        details: authError.message 
      }, { status: 401 });
    }
    
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    console.log('[status] Getting status...');
    const status = await dataImportService.getImportStatus();
    console.log('[status] Got status, count:', status?.length);
    
    console.log('[status] Getting logs...');
    const logs = await dataImportService.getImportLogs(10);
    console.log('[status] Got logs, count:', logs?.length);

    return NextResponse.json({ status, logs });
  } catch (error: any) {
    console.error('[status] Error:', error.message);
    console.error('[status] Stack:', error.stack);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}