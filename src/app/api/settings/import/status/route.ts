import { NextRequest, NextResponse } from 'next/server';
import { dataImportService } from '@/server/services/data-import-service';
import { authService } from '@/server/services/auth-service';

export async function GET(request: NextRequest) {
  try {
    console.log('[status] Checking auth...');
    let user;
    try {
      user = await authService.requireCurrentUser();
    } catch (authError: any) {
      console.log('[status] Auth error:', authError.message);
      return NextResponse.json({ 
        error: 'Unauthorized - you need to be logged in as admin',
        details: authError.message 
      }, { status: 401 });
    }
    console.log('[status] User:', user?.email, 'roles:', user?.roles);
    
    // Check admin role
    const isAdmin = user?.roles?.some((r: any) => r === 'admin');
    console.log('[status] isAdmin:', isAdmin);
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