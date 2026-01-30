
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { AppUser } from '@/services/user';
import { Competition } from '@/app/(admin)/admin/competitions/page';
import { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { startOfDay, endOfDay } from 'date-fns';

// --- Initialize Firebase Admin SDK ---
// This ensures the SDK is initialized only once.
if (!admin.apps.length) {
  try {
    // In a managed Google Cloud environment (like App Hosting), the SDK can auto-initialize.
    // For local development, you would need to set up a service account.
    admin.initializeApp();
    console.log('[API] Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('[API] Firebase Admin SDK initialization error:', error.stack);
  }
}

const db = admin.firestore();

// --- Helper Functions using Admin SDK ---

async function findUser(email?: string, userName?: string): Promise<AppUser> {
    const usersRef = db.collection('users');
    let userQuery: admin.firestore.Query;

    if (email) {
        userQuery = usersRef.where('email', '==', email).limit(1);
    } else if (userName) {
        userQuery = usersRef.where('name', '==', userName);
    } else {
        throw new Error('User identifier (email or userName) is required.');
    }

    const userSnapshot = await userQuery.get();

    if (userSnapshot.empty) {
        throw new Error(`User not found with identifier.`);
    }

    if (userSnapshot.size > 1) {
        throw new Error(`Multiple users found with the name "${userName}". Please use a unique identifier like email.`);
    }

    const userDoc = userSnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as AppUser;
}

async function findActiveCompetition(podId: string): Promise<Competition & { id: string }> {
    const today = new Date();
    const competitionsRef = db.collection('competitions');
    const competitionQuery = competitionsRef
        .where('podIds', 'array-contains', podId)
        .orderBy('startDate', 'desc');

    const competitionSnapshot = await competitionQuery.get();
    if (competitionSnapshot.empty) {
        throw new Error(`No competitions found for pod ${podId}.`);
    }

    for (const docSnap of competitionSnapshot.docs) {
        const comp = { id: docSnap.id, ...docSnap.data() } as (Competition & { id: string });

        // Ensure dates are valid Timestamps before converting
        if (comp.startDate?.toDate && comp.endDate?.toDate) {
            const compStart = startOfDay(comp.startDate.toDate());
            const compEnd = endOfDay(comp.endDate.toDate());

            if (compStart <= today && today <= compEnd) {
                console.log(`[API Helper] Found active competition: ${comp.name}`);
                return comp;
            }
        }
    }

    throw new Error(`No *active* competition found for pod ${podId}.`);
}

function parseAchievementText(text: string): { ruleName: string, value: number } {
    const hashtagMatch = text.match(/#(\w+)/);
    if (!hashtagMatch) {
        throw new Error('No achievement hashtag (#ruleName) found in text.');
    }
    const ruleName = hashtagMatch[1];

    const multiplierMatch = text.match(/(?:x|\*)\s*(\d+)/i);
    const value = multiplierMatch ? parseInt(multiplierMatch[1], 10) : 1;

    if (isNaN(value) || value <= 0) {
        throw new Error('Invalid or non-positive multiplier value found.');
    }

    return { ruleName, value };
}

async function logAchievement(logData: Omit<DailyAchievementLog, 'id' | 'status'>): Promise<string> {
    const newLogDoc = await db.collection('dailyAchievements').add(logData);
    return newLogDoc.id;
}


// --- Main API Route (POST) ---

export async function POST(request: Request) {
    const apiKey = request.headers.get('x-api-key');
    const serverApiKey = process.env.LOG_ACHIEVEMENT_API_KEY;

    if (!serverApiKey) {
        console.error('[API] CRITICAL: LOG_ACHIEVEMENT_API_KEY is not set.');
        return NextResponse.json({ error: 'Internal Server Error: API is not configured.' }, { status: 500 });
    }
    if (apiKey !== serverApiKey) {
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, userName, text } = body;
    if ((!email && !userName) || !text) {
        return NextResponse.json({ error: 'Missing required fields: (email or userName) and text must be provided.' }, { status: 400 });
    }

    try {
        const user = await findUser(email, userName);
        if (!user.podId) {
            return NextResponse.json({ error: `User ${user.name} is not assigned to a pod.` }, { status: 400 });
        }

        const competition = await findActiveCompetition(user.podId);
        if (!competition.rules || competition.rules.length === 0) {
            return NextResponse.json({ error: `The active competition "${competition.name}" has no rules configured.` }, { status: 400 });
        }

        const { ruleName: ruleNameFromHashtag, value } = parseAchievementText(text);
        const rule = competition.rules.find(r => r.name.toLowerCase() === ruleNameFromHashtag.toLowerCase());
        if (!rule || !rule.id) {
            return NextResponse.json({ error: `Rule #${ruleNameFromHashtag} not found in competition "${competition.name}".` }, { status: 404 });
        }

        if (rule.type !== 'numeric') {
            return NextResponse.json({ error: `Rule #${ruleNameFromHashtag} is a checkbox task and cannot be logged via this API.` }, { status: 400 });
        }

        const points = (rule.points || 0) * value;
        const logEntry: Omit<DailyAchievementLog, 'id' | 'status'> = {
            agentId: user.id!,
            podId: user.podId,
            competitionId: competition.id,
            ruleId: rule.id,
            ruleName: rule.name,
            date: admin.firestore.Timestamp.fromDate(startOfDay(new Date())),
            value,
            points,
            loggedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
            loggedBy: 'api_workflow',
        };

        const logId = await logAchievement(logEntry);

        return NextResponse.json({
            message: 'Achievement logged successfully.',
            logId,
            loggedData: { agent: user.name, rule: rule.name, value, points },
        }, { status: 201 });

    } catch (error: any) {
        console.error(`[API] Error during processing: ${error.message}`);
        const isNotFound = /not found/i.test(error.message);
        const isBadRequest = /multiple users|invalid|required/i.test(error.message);
        const status = isNotFound ? 404 : isBadRequest ? 400 : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
