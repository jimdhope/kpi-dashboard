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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Import exceeds the 25 MB upload limit" }, { status: 413 });
    }

    if (!file.name.endsWith('.json')) {
      return NextResponse.json({ error: 'Only JSON files are accepted' }, { status: 400 });
    }

    const fileContent = await file.text();
    const result = await dataImportService.uploadExport(fileContent);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error uploading export file:', error);
    return NextResponse.json(
      { error: 'Upload failed. Check the server logs for details.' },
      { status: 500 }
    );
  }
}
