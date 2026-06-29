import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/server/services/auth-service';

export async function POST(request: NextRequest) {
  try {
    const user = await authService.requireCurrentUser();
    
    // Check admin role
    const isAdmin = user.roles?.some((r: any) => r === 'admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!file.name.endsWith('.json')) {
      return NextResponse.json({ error: 'Only JSON files are accepted' }, { status: 400 });
    }

    const fileContent = await file.text();
    
    // Validate the service account JSON structure (local validation only)
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(fileContent);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 });
    }

    // Check required fields
    if (!serviceAccount.project_id) {
      return NextResponse.json({ error: 'Invalid service account: missing project_id' }, { status: 400 });
    }
    if (!serviceAccount.private_key) {
      return NextResponse.json({ error: 'Invalid service account: missing private_key' }, { status: 400 });
    }
    if (!serviceAccount.client_email) {
      return NextResponse.json({ error: 'Invalid service account: missing client_email' }, { status: 400 });
    }

    // Local validation passed - return success
    // Actual Firebase connection will be tested during import
    return NextResponse.json({
      success: true,
      projectId: serviceAccount.project_id,
      message: 'Service account JSON is valid. Firebase connection will be tested during import.'
    });
  } catch (error) {
    console.error('Error validating service account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}