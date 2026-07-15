import { NextRequest, NextResponse } from 'next/server';
import { dataImportService } from '@/server/services/data-import-service';
import { authService } from '@/server/services/auth-service';
import { permissionService } from '@/server/services/permission-service';

export async function POST(request: NextRequest) {
  try {
    const user = await authService.requireCurrentUser();
    const isAdmin = await permissionService.hasEffectiveAdminAccess(user.roles);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const declaredSize = Number(request.headers.get('content-length') || 0);
    if (declaredSize > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Import request exceeds the 2 MB limit' }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Import request exceeds the 2 MB limit' }, { status: 413 });
    }
    const body = JSON.parse(rawBody);
    const source = body.source || 'existing';

    // Handle Firebase source - import directly from Firestore
    if (source === 'firebase') {
      if (!body.serviceAccountJson) {
        return NextResponse.json({ error: 'Service account JSON required for Firebase import' }, { status: 400 });
      }

      const result = await dataImportService.syncFromFirebase(body.serviceAccountJson);

      if (result.success) {
        return NextResponse.json({
          ...result,
        });
      } else {
        return NextResponse.json({
          error: result.error || 'Firebase import failed'
        }, { status: 500 });
      }
    }

    // Handle existing file or upload source
    const result = await dataImportService.syncAll(source);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error running import sync:', error);
    return NextResponse.json(
      { error: 'Import failed. Check the server logs for details.' },
      { status: 500 }
    );
  }
}
