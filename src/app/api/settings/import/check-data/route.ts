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

    const tempCredPath = path.join(process.cwd(), 'check_creds.json');
    const debugLogPath = path.join(process.cwd(), 'check_firebase_log.txt');
    
    fs.writeFileSync(tempCredPath, serviceAccountJson);
    fs.writeFileSync(debugLogPath, `=== Check Firebase Data Started ===\n`);
    
    return new Promise((resolve) => {
      // Run a quick script to dump competition data structure
      const child = spawn('npx', ['tsx', '-e', `
        import * as admin from 'firebase-admin';
        import * as fs from 'fs';
        
        const creds = JSON.parse(fs.readFileSync('${tempCredPath}', 'utf8'));
        const app = admin.initializeApp({ credential: admin.credential.cert(creds) });
        const db = admin.firestore();
        
        async function main() {
          const snapshot = await db.collection('competitions').limit(3).get();
          
          console.log('=== Sample competition documents ===');
          for (const doc of snapshot.docs) {
            console.log('\\nDocument ID:', doc.id);
            console.log('All fields:', JSON.stringify(doc.data(), null, 2));
          }
          
          // Also check dailyAchievements
          const achSnap = await db.collection('dailyAchievements').limit(2).get();
          console.log('\\n=== Sample achievement documents ===');
          for (const doc of achSnap.docs) {
            console.log('\\nDocument ID:', doc.id);
            console.log('All fields:', JSON.stringify(doc.data(), null, 2));
          }
          
          process.exit(0);
        }
        
        main().catch(e => { console.error(e); process.exit(1); });
      `], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        fs.appendFileSync(debugLogPath, text);
      });
      
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        fs.appendFileSync(debugLogPath, '[STDERR] ' + text);
      });
      
      child.on('close', (code: number) => {
        try { fs.unlinkSync(tempCredPath); } catch (e) {}
        
        resolve(NextResponse.json({
          log: stdout.substring(0, 15000),
          stderr: stderr.substring(0, 2000)
        }));
      });
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}