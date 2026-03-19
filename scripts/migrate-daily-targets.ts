import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

interface OldTargetData {
  [ruleId: string]: {
    mon?: number | null;
    tue?: number | null;
    wed?: number | null;
    thu?: number | null;
    fri?: number | null;
    sat?: number | null;
    sun?: number | null;
  };
}

interface NewTargetData {
  [ruleId: string]: number;
}

async function migrateDailyTargets() {
  console.log('Starting daily targets migration...\n');

  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('ERROR: service-account.json not found in scripts/ directory');
    console.log('Please download your Firebase service account JSON and save it as:');
    console.log('  scripts/service-account.json\n');
    console.log('Get it from: Firebase Console > Project Settings > Service Accounts > Generate new private key');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  const db = admin.firestore();

  console.log('Fetching all dailyPodTargets documents...\n');

  const snapshot = await db.collection('dailyPodTargets').get();

  if (snapshot.empty) {
    console.log('No documents found in dailyPodTargets collection.');
    console.log('Migration complete (nothing to do).');
    process.exit(0);
  }

  console.log(`Found ${snapshot.size} documents to migrate.\n`);

  const batch = db.batch();
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  snapshot.forEach((doc) => {
    const oldData = doc.data() as OldTargetData;
    
    try {
      const newData: NewTargetData = {};

      for (const ruleId in oldData) {
        const dayTargets = oldData[ruleId];
        
        if (dayTargets && typeof dayTargets === 'object') {
          const mondayValue = dayTargets.mon;
          
          if (mondayValue !== null && mondayValue !== undefined && mondayValue >= 0) {
            newData[ruleId] = mondayValue;
          } else {
            const values: number[] = [
              dayTargets.mon ?? -1,
              dayTargets.tue ?? -1,
              dayTargets.wed ?? -1,
              dayTargets.thu ?? -1,
              dayTargets.fri ?? -1,
              dayTargets.sat ?? -1,
              dayTargets.sun ?? -1,
            ].filter((v) => v >= 0);

            if (values.length > 0) {
              newData[ruleId] = values[0];
            }
          }
        }
      }

      if (Object.keys(newData).length > 0) {
        batch.set(doc.ref, newData);
        migratedCount++;
        console.log(`  [${migratedCount}] ${doc.id}: Migrated (${Object.keys(newData).length} rules)`);
      } else {
        skippedCount++;
        console.log(`  [SKIP] ${doc.id}: No valid targets found`);
      }
    } catch (error: any) {
      errorCount++;
      errors.push(`${doc.id}: ${error.message}`);
      console.log(`  [ERROR] ${doc.id}: ${error.message}`);
    }
  });

  console.log('\nCommitting changes to Firestore...\n');

  await batch.commit();

  console.log('========================================');
  console.log('           MIGRATION COMPLETE           ');
  console.log('========================================');
  console.log(`  Migrated:  ${migratedCount} documents`);
  console.log(`  Skipped:   ${skippedCount} documents`);
  console.log(`  Errors:    ${errorCount} documents`);
  console.log('========================================\n');

  if (errors.length > 0) {
    console.log('Errors encountered:');
    errors.forEach((err) => console.log(`  - ${err}`));
    console.log('');
  }

  console.log('Note: The old documents have been overwritten with the new format.');
  console.log('If you need to rollback, restore from a Firestore backup.\n');
}

migrateDailyTargets().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
