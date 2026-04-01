import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const { serviceAccountJson } = await request.json();
    
    if (!serviceAccountJson) {
      return NextResponse.json({ error: 'No service account provided' }, { status: 400 });
    }

    // Write to a known file we can read after
    const debugLogPath = path.join(process.cwd(), 'firebase_import_debug.log');
    const tempCredPath = path.join(process.cwd(), 'debug_creds.json');
    
    fs.writeFileSync(tempCredPath, serviceAccountJson);
    fs.writeFileSync(debugLogPath, `=== Firebase Import Started at ${new Date().toISOString()} ===\n`);
    
    console.log('Starting debug Firebase import...');
    
    return new Promise((resolve) => {
      const child = spawn('npx', ['tsx', 'scripts/import-from-firebase.ts', tempCredPath], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        fs.appendFileSync(debugLogPath, `[STDOUT] ${text}`);
      });
      
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        fs.appendFileSync(debugLogPath, `[STDERR] ${text}`);
      });
      
      child.on('close', (code: number) => {
        fs.appendFileSync(debugLogPath, `\n=== Exit code: ${code} ===\n`);
        
        // Clean up
        try { fs.unlinkSync(tempCredPath); } catch (e) {}
        
        // Read and return the log
        const logContent = fs.readFileSync(debugLogPath, 'utf8');
        
        resolve(NextResponse.json({
          exitCode: code,
          logLength: logContent.length,
          log: logContent.substring(0, 10000), // First 10k chars
          stderr: stderr.substring(0, 2000)
        }));
      });
      
      child.on('error', (err: Error) => {
        fs.appendFileSync(debugLogPath, `[ERROR] ${err.message}\n`);
        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
      });
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}