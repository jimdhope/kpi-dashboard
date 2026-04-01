import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { serviceAccountJson } = await request.json();
    
    if (!serviceAccountJson) {
      return NextResponse.json({ error: 'No service account provided' }, { status: 400 });
    }

    // Write service account to temp file
    const tempCredPath = path.join(process.cwd(), 'debug_firebase_creds.json');
    fs.writeFileSync(tempCredPath, serviceAccountJson);
    console.log('[Debug Import] Wrote creds to:', tempCredPath);
    
    // Check file was created
    const stats = fs.statSync(tempCredPath);
    console.log('[Debug Import] File size:', stats.size);

    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'scripts/import-from-firebase.ts', tempCredPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });
      
      child.on('close', (code: number) => {
        // Clean up
        try { fs.unlinkSync(tempCredPath); } catch (e) {}
        
        console.log('[Debug Import] Exit code:', code);
        console.log('[Debug Import] Stdout length:', stdout.length);
        console.log('[Debug Import] Stderr length:', stderr.length);
        
        // Show first 500 chars of each
        console.log('[Debug Import] Stdout preview:', stdout.substring(0, 500));
        console.log('[Debug Import] Stderr preview:', stderr.substring(0, 500));
        
        if (code === 0) {
          resolve(NextResponse.json({ 
            success: true, 
            code,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
            preview: stdout.substring(0, 1000)
          }));
        } else {
          resolve(NextResponse.json({ 
            success: false, 
            code,
            error: stderr,
            stdoutPreview: stdout.substring(0, 500)
          }, { status: 500 }));
        }
      });
      
      child.on('error', (err: Error) => {
        try { fs.unlinkSync(tempCredPath); } catch (e) {}
        resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
      });
    });
    
  } catch (error: any) {
    console.error('[Debug Import] Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}