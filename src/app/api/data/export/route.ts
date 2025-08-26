
import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { listAll } from 'firebase/auth'; // We won't use this for now, security risk.
import { getAuth } from "firebase/auth";


// Define the collections you want to export.
// It's safer and more maintainable to explicitly list them.
const COLLECTIONS_TO_EXPORT = [
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
];

export async function GET() {
  try {
    const allData: Record<string, any[]> = {};
    
    for (const collectionName of COLLECTIONS_TO_EXPORT) {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      allData[collectionName] = snapshot.docs.map(doc => ({
        _id: doc.id, // Use _id to avoid conflicts with data fields named 'id'
        ...doc.data() 
      }));
    }

    const jsonString = JSON.stringify(allData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    return new Response(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="kpi-quest-backup.json"`,
      },
    });

  } catch (error: any) {
    console.error("Error during data export:", error);
    return NextResponse.json({ error: `Failed to export data: ${error.message}` }, { status: 500 });
  }
}
