import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, '..', '..', 'v2', 'scripts', 'kpiquest-firebase-adminsdk-fbsvc-a084cac56d.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function exportCollection(collectionName: string, outputFilename: string) {
  console.log(`Exporting ${collectionName}...`);
  
  const snapshot = await db.collection(collectionName).get();
  const documents: any[] = [];
  
  snapshot.forEach((doc) => {
    documents.push({
      id: doc.id,
      ...doc.data(),
    });
  });
  
  const outputPath = path.join(__dirname, 'exports', outputFilename);
  fs.writeFileSync(outputPath, JSON.stringify(documents, null, 2));
  console.log(`  Exported ${documents.length} documents to ${outputFilename}`);
  
  return documents.length;
}

async function main() {
  console.log('\n=== Export Performance Data from Firebase ===\n');
  
  try {
    // Export additionalKpis (Performance KPIs)
    const kpiCount = await exportCollection('additionalKpis', 'additionalKpis.json');
    
    // Export additionalKpiLogs (Performance KPI Logs)
    const logCount = await exportCollection('additionalKpiLogs', 'additionalKpiLogs.json');
    
    console.log('\n=== Export Complete ===');
    console.log(`  KPIs: ${kpiCount}`);
    console.log(`  KPI Logs: ${logCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  }
}

main();
