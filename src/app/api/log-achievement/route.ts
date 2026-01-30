
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, Timestamp, doc, addDoc, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/models/types';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { startOfDay, endOfDay } from 'date-fns';

// --- Helper Functions for API Logic ---

/**
 * Finds a user by email or display name. Throws an error if not found or if the name is ambiguous.
 */
async function findUser(email?: string, userName?: string): Promise<AppUser> {
    const usersRef = collection(db, 'users');
    let userQuery;

    if (email) {
        console.log(`[API Helper] Searching for user by email: ${email}`);
        userQuery = query(usersRef, where('email', '==', email), limit(1));
    } else if (userName) {
        console.log(`[API Helper] Searching for user by name: ${userName}`);
        userQuery = query(usersRef, where('name', '==', userName));
    } else {
        throw new Error('User identifier (email or userName) is required.');
    }

    const userSnapshot = await getDocs(userQuery);

    if (userSnapshot.empty) {
        throw new Error(`User not found.`);
    }

    if (userSnapshot.size > 1) {
        throw new Error(`Multiple users found with the name "${userName}". Please use a unique identifier.`);
    }

    const userDoc = userSnapshot.docs[0];
    console.log(`[API Helper] Found user: ${userDoc.data().name} (ID: ${userDoc.id})`);
    return { id: userDoc.id, ...userDoc.data() } as AppUser;
}

/**
 * Finds the most recent, currently active competition for a given pod.
 */
async function findActiveCompetition(podId: string): Promise<Competition & { id: string }> {
    const today = new Date();
    console.log(`[API Helper] Searching for active competition for pod ${podId} on ${today.toUTCString()}`);

    const competitionsRef = collection(db, 'competitions');
    const competitionQuery = query(
        competitionsRef,
        where('podIds', 'array-contains', podId),
        orderBy('startDate', 'desc')
    );

    const competitionSnapshot = await getDocs(competitionQuery);
    if (competitionSnapshot.empty) {
        throw new Error(`No competitions found for pod ${podId}.`);
    }

    for (const docSnap of competitionSnapshot.docs) {
        const comp = { id: docSnap.id, ...docSnap.data() } as (Competition & { id: string });

        if (comp.startDate?.toDate && comp.endDate?.toDate) {
            const compStart = startOfDay(comp.startDate.toDate());
            const compEnd = endOfDay(comp.endDate.toDate()); // Use endOfDay for a full-day check

            if (compStart <= today && today <= compEnd) {
                console.log(`[API Helper] Found active competition: ${comp.name}`);
                return comp;
            }
        }
    }

    throw new Error(`No *active* competition found for pod ${podId}.`);
}

/**
 * Parses text to find a rule and multiplier.
 * @returns { ruleName: string, value: number }
 */
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

    console.log(`[API Helper] Parsed text. Found rule: #${ruleName}, value: ${value}`);
    return { ruleName, value };
}

/**
 * Logs the achievement document to Firestore.
 */
async function logAchievement(logData: Omit<DailyAchievementLog, 'id' | 'status'>): Promise<string> {
    const newLogDoc = await addDoc(collection(db, 'dailyAchievements'), logData);
    console.log(`[API Helper] Successfully logged achievement. Log ID: ${newLogDoc.id}`);
    return newLogDoc.id;
}


// --- Main API Route (POST) ---

export async function POST(request: Request) {
    console.log(`[API] Received request: ${request.method} ${request.url}`);
    
    // 1. Authenticate the request
    const apiKey = request.headers.get('x-api-key');
    const serverApiKey = process.env.LOG_ACHIEVEMENT_API_KEY;

    if (!serverApiKey) {
        console.error('[API] CRITICAL: LOG_ACHIEVEMENT_API_KEY is not set. API is disabled.');
        return NextResponse.json({ error: 'Internal Server Error: API is not configured.' }, { status: 500 });
    }
    if (apiKey !== serverApiKey) {
        console.warn(`[API] Unauthorized access attempt.`);
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    // 2. Parse and Validate Body
    let body;
    try {
        body = await request.json();
        console.log(`[API] Request Body:`, JSON.stringify(body, null, 2));

        const { email, userName, text } = body;
        if ((!email && !userName) || !text) {
            return NextResponse.json({ error: 'Missing required fields: (email or userName) and text must be provided.' }, { status: 400 });
        }

        // 3. Main Logic in a Try/Catch block
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
                date: Timestamp.fromDate(startOfDay(new Date())),
                value,
                points,
                loggedAt: serverTimestamp(),
                loggedBy: 'api_workflow',
            };

            const logId = await logAchievement(logEntry);

            return NextResponse.json({
                message: 'Achievement logged successfully.',
                logId,
                loggedData: {
                    agent: user.name,
                    rule: rule.name,
                    value,
                    points,
                },
            }, { status: 201 });

        } catch (error: any) {
            console.error(`[API] Error during processing: ${error.message}`);
            // Determine status code based on error message
            const isNotFound = /not found/i.test(error.message);
            const isBadRequest = /multiple users|invalid|required/i.test(error.message);
            const status = isNotFound ? 404 : isBadRequest ? 400 : 500;
            return NextResponse.json({ error: error.message }, { status });
        }

    } catch (error) {
        console.error('[API] Invalid JSON body:', error);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
}
