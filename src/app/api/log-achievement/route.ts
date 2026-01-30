
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, Timestamp, doc, addDoc, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { startOfDay } from 'date-fns';

export async function POST(request: Request) {
    console.log(`[API /api/log-achievement] Received request: ${request.method} ${request.url}`);
    const apiKey = request.headers.get('x-api-key');
    const serverApiKey = process.env.LOG_ACHIEVEMENT_API_KEY;

    // Add a check to ensure the API key is configured on the server
    if (!serverApiKey) {
        console.error('CRITICAL: LOG_ACHIEVEMENT_API_KEY is not set in the environment. The API endpoint is insecure and disabled.');
        return NextResponse.json({ error: 'Internal Server Error: API is not configured.' }, { status: 500 });
    }

    if (apiKey !== serverApiKey) {
        console.warn(`[API /api/log-achievement] Unauthorized access attempt with API key: ${apiKey}`);
        return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        console.error('[API /api/log-achievement] Error parsing JSON body:', error);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    
    // Improved logging: Log the actual body and relevant headers received.
    const headersObject: { [key: string]: string } = {};
    request.headers.forEach((value, key) => {
        headersObject[key] = value;
    });

    console.log(`[API /api/log-achievement] Request Headers:`, JSON.stringify(headersObject, null, 2));
    console.log(`[API /api/log-achievement] Request Body:`, JSON.stringify(body, null, 2));


    const { email, text } = body;
    // Log the extracted values for easier debugging
    console.log(`[API /api/log-achievement] Extracted email: "${email}", Extracted text: "${text}"`);

    if (!email || !text) {
        const missingFields = [];
        if (!email) missingFields.push('email');
        if (!text) missingFields.push('text');
        
        const errorMessage = `Missing required fields: ${missingFields.join(' and ')}. Please check the Power Automate flow configuration.`;
        console.error(`[API /api/log-achievement] Validation failed: ${errorMessage}`);
        
        // Return a more descriptive error including the body that was received.
        return NextResponse.json({ 
            error: errorMessage,
            receivedBody: body, // Return the problematic body for easier debugging on the client side.
        }, { status: 400 });
    }

    try {
        // 1. Find user by email
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', email), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            console.log(`[API /api/log-achievement] User not found for email: ${email}`);
            return NextResponse.json({ error: `User with email ${email} not found.` }, { status: 404 });
        }
        const userDoc = userSnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() } as AppUser;
        const { id: userId, podId } = userData;
        console.log(`[API /api/log-achievement] Found user: ${userData.name} in pod: ${podId}`);


        if (!podId) {
            return NextResponse.json({ error: `User ${email} is not assigned to a pod.` }, { status: 400 });
        }

        // 2. Find active competition for the user's pod
        const today = new Date();
        const competitionsRef = collection(db, 'competitions');
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', podId),
            orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);

        let activeCompetition: (Competition & { id: string }) | null = null;
        for (const docSnap of competitionSnapshot.docs) {
            const comp = { id: docSnap.id, ...docSnap.data() } as (Competition & { id: string });
            // Ensure dates are valid before comparing
            if (comp.startDate?.toDate && comp.endDate?.toDate) {
                if (comp.startDate.toDate() <= today && comp.endDate.toDate() >= today) {
                    activeCompetition = comp;
                    break;
                }
            }
        }

        if (!activeCompetition) {
            console.log(`[API /api/log-achievement] No active competition found for pod: ${podId}`);
            return NextResponse.json({ error: `No active competition found for pod ${podId}.` }, { status: 404 });
        }
        console.log(`[API /api/log-achievement] Found active competition: ${activeCompetition.name}`);

        // **FIX**: Check if rules exist on the competition before trying to access them
        if (!activeCompetition.rules || !Array.isArray(activeCompetition.rules)) {
            console.error(`[API /api/log-achievement] Internal Data Error: Competition "${activeCompetition.name}" (ID: ${activeCompetition.id}) is missing a 'rules' array.`);
            return NextResponse.json({ error: `Internal Data Error: The active competition "${activeCompetition.name}" has no rules configured.` }, { status: 500 });
        }

        // 3. Parse text for hashtag and multiplier
        const hashtagMatch = text.match(/#(\w+)/);
        if (!hashtagMatch) {
            console.log(`[API /api/log-achievement] No hashtag found in text: "${text}"`);
            return NextResponse.json({ error: 'No achievement hashtag found in text.' }, { status: 400 });
        }
        const ruleNameFromHashtag = hashtagMatch[1];
        
        // Look for multipliers like x2, x 2, *2, * 2
        const multiplierMatch = text.match(/(?:x|\*)\s*(\d+)/i);
        const value = multiplierMatch ? parseInt(multiplierMatch[1], 10) : 1;

        if (isNaN(value) || value <= 0) {
             console.log(`[API /api/log-achievement] Invalid multiplier value in text: "${text}"`);
            return NextResponse.json({ error: 'Invalid multiplier value.' }, { status: 400 });
        }

        // 4. Find the matching rule in the competition (case-insensitive)
        const rule = activeCompetition.rules.find(
            (r) => r.name.toLowerCase() === ruleNameFromHashtag.toLowerCase()
        );

        if (!rule || !rule.id) {
            console.log(`[API /api/log-achievement] Rule for hashtag "${ruleNameFromHashtag}" not found in competition.`);
            return NextResponse.json({ error: `Rule matching hashtag #${ruleNameFromHashtag} not found in active competition.` }, { status: 404 });
        }

        if (rule.type !== 'numeric') {
             console.log(`[API /api/log-achievement] Attempted to log non-numeric rule "${rule.name}" via API.`);
             return NextResponse.json({ error: `Rule #${ruleNameFromHashtag} is not a numeric achievement and cannot be logged this way.` }, { status: 400 });
        }

        // 5. Log the achievement
        const points = (rule.points || 0) * value;
        const logEntry: Omit<DailyAchievementLog, 'id' | 'status'> = {
            agentId: userId,
            podId: podId,
            competitionId: activeCompetition.id,
            ruleId: rule.id,
            ruleName: rule.name,
            date: Timestamp.fromDate(startOfDay(today)),
            value: value,
            points: points,
            loggedAt: serverTimestamp(),
            loggedBy: 'api_workflow', // System identifier
        };

        const newLogDoc = await addDoc(collection(db, 'dailyAchievements'), logEntry);
        console.log(`[API /api/log-achievement] Successfully logged achievement. Log ID: ${newLogDoc.id}`);

        return NextResponse.json({
            message: 'Achievement logged successfully.',
            logId: newLogDoc.id,
            loggedData: {
                agent: userData.name,
                rule: rule.name,
                value: value,
                points: points,
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error('Error in /api/log-achievement:', error);
        return NextResponse.json({ error: 'An internal server error occurred.', details: error.message }, { status: 500 });
    }
}
