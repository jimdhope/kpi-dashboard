import { NextRequest, NextResponse } from 'next/server';
import { dataImportService } from '@/server/services/data-import-service';
import { authService } from '@/server/services/auth-service';

export async function POST(request: NextRequest) {
  try {
    const user = await authService.requireCurrentUser();
    
    // Check admin role
    const isAdmin = user.roles?.some((r: any) => r === 'admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
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
      { error: `Import failed: ${error}` },
      { status: 500 }
    );
  }
}