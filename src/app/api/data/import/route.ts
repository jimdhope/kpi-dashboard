
import { NextResponse } from 'next/server';
import { collection, doc, writeBatch, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Explicitly list collections to prevent accidental writes to unintended collections.
const ALLOWED_COLLECTIONS = new Set([
  'campaigns',
  'pods',
  'users',
  'competitions',
  'dailyAchievements',
  'dailyPodTargets',
  'dailyTaskLogs',
  'teamBonusLogs',
  'rpsGames',
  'settings'
]);


export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // --- Data Validation ---
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid backup file format. Expected a JSON object of collections." }, { status: 400 });
    }

    const collectionsToImport = Object.keys(data);
    for (const collectionName of collectionsToImport) {
        if (!ALLOWED_COLLECTIONS.has(collectionName)) {
            return NextResponse.json({ error: `Invalid collection in backup file: "${collectionName}". Import aborted.` }, { status: 400 });
        }
        if (!Array.isArray(data[collectionName])) {
             return NextResponse.json({ error: `Invalid data for collection "${collectionName}". Expected an array of documents.` }, { status: 400 });
        }
    }
    
    console.log(`Starting data import for collections: ${collectionsToImport.join(', ')}`);

    let totalRecordsProcessed = 0;

    // --- Deletion Phase ---
    console.log("Starting deletion of existing data...");
    for (const collectionName of collectionsToImport) {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        // Firestore batches have a limit of 500 operations.
        // We'll process deletions in chunks of 499 to be safe.
        const chunks: any[][] = [];
        for (let i = 0; i < snapshot.docs.length; i += 499) {
            chunks.push(snapshot.docs.slice(i, i + 499));
        }
        for (const chunk of chunks) {
             const deleteBatch = writeBatch(db);
             chunk.forEach(doc => deleteBatch.delete(doc.ref));
             await deleteBatch.commit();
        }
        console.log(`Deleted ${snapshot.docs.length} documents from ${collectionName}.`);
    }
     console.log("Deletion phase complete.");

    // --- Insertion Phase ---
     console.log("Starting insertion of new data...");
    for (const collectionName of collectionsToImport) {
        const documents = data[collectionName];
        if (documents.length === 0) continue;

         // Process insertions in chunks of 499 as well.
        const chunks: any[][] = [];
        for (let i = 0; i < documents.length; i += 499) {
            chunks.push(documents.slice(i, i + 499));
        }

        for (const chunk of chunks) {
            const writeBatch = writeBatch(db);
             chunk.forEach((docData: any) => {
                 const { _id, ...restOfData } = docData; // Separate the custom _id field
                 if (!_id) {
                     console.warn(`Skipping document in ${collectionName} because it's missing the '_id' field.`);
                     return;
                 }
                const docRef = doc(db, collectionName, _id);
                writeBatch.set(docRef, restOfData);
             });
             await writeBatch.commit();
             totalRecordsProcessed += chunk.length;
        }
        console.log(`Inserted ${documents.length} documents into ${collectionName}.`);
    }
    console.log("Insertion phase complete.");


    return NextResponse.json({ 
        message: "Import successful.",
        collectionCount: collectionsToImport.length,
        totalRecords: totalRecordsProcessed
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error during data import:", error);
    return NextResponse.json({ error: `Failed to import data: ${error.message}` }, { status: 500 });
  }
}
