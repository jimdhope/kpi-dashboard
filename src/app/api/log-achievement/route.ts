
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { AppUser } from '@/services/user';
import { Competition } from '@/app/(admin)/admin/competitions/page';
import { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { startOfDay, endOfDay } from 'date-fns';
import { JSDOM } from 'jsdom';

// --- Initialize Firebase Admin SDK ---
// This check ensures we don't re-initialize the app in a serverless environment
if (!admin.apps.length) {
  try {
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
        userQuery = usersRef.where('name', '==', userName).limit(1);
    } else {
        throw new Error('User identifier (email or userName) is required.');
    }

    const userSnapshot = await userQuery.get();

    if (userSnapshot.empty) {
        throw new Error(`User not found with identifier.`);
    }

    if (userSnapshot.size > 1) {
        console.warn(`[API] Multiple users found with name "${userName}". Using the first result.`);
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
        // Log the raw incoming body for debugging
        console.log('[API] Received request body:', JSON.stringify(body, null, 2));
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
        const { email, userName, text } = body;
        
        if ((!email && !userName) || !text) {
            console.error('[API] Bad Request: Missing required fields.', body);
            return NextResponse.json({ error: 'Missing required fields: (email or userName) and text must be provided.' }, { status: 400 });
        }

        const user = await findUser(email, userName);
        console.log(`[API] Found user: ${user.name} (Pod ID: ${user.podId || 'None'})`);

        if (!user.podId) {
            console.error(`[API] Bad Request: User ${user.name} is not assigned to a pod.`);
            return NextResponse.json({ error: `User ${user.name} is not assigned to a pod.` }, { status: 400 });
        }

        const competition = await findActiveCompetition(user.podId);
        
        if (!competition.rules || competition.rules.length === 0) {
            console.error(`[API] Bad Request: Competition "${competition.name}" has no rules.`);
            return NextResponse.json({ error: `The active competition "${competition.name}" has no rules configured.` }, { status: 400 });
        }
        
        // --- NEW: Strip HTML from the text content ---
        const dom = new JSDOM(text);
        const plainText = dom.window.document.body.textContent || "";
        console.log(`[API] Plain text content after stripping HTML: "${plainText}"`);

        // Use the plain text for parsing
        const { ruleName: ruleNameFromHashtag, value } = parseAchievementText(plainText);
        const rule = competition.rules.find(r => r.name.toLowerCase() === ruleNameFromHashtag.toLowerCase());
        
        if (!rule || !rule.id) {
            console.error(`[API] Not Found: Rule #${ruleNameFromHashtag} not found.`);
            return NextResponse.json({ error: `Rule #${ruleNameFromHashtag} not found in competition "${competition.name}".` }, { status: 404 });
        }
        console.log(`[API] Matched rule: ${rule.name} (Type: ${rule.type})`);

        if (rule.type !== 'numeric') {
            console.error(`[API] Bad Request: Rule #${ruleNameFromHashtag} is a checkbox task.`);
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
        const errorMessage = error.message || 'An unknown internal error occurred.';
        console.error(`[API] Error during processing: ${errorMessage}`, { received_body: body });
        const isNotFound = /not found/i.test(errorMessage);
        const isBadRequest = /multiple users|invalid|required|not assigned|no achievement hashtag/i.test(errorMessage);
        const status = isNotFound ? 404 : isBadRequest ? 400 : 500;
        
        return NextResponse.json({ error: errorMessage }, { status });
    }
}

