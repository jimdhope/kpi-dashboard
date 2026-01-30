
import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, Timestamp, doc, addDoc, orderBy, serverTimestamp, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { startOfDay } from 'date-fns';

export async function POST(request: Request) {
    const apiKey = request.headers.get('x-api-key');
    const serverApiKey = process.env.LOG_ACHIEVEMENT_API_KEY;

    // Add a check to ensure the API key is configured on the server
    if (!serverApiKey) {
        console.error('CRITICAL: LOG_ACHIEVEMENT_API_KEY is not set in the environment. The API endpoint is insecure and disabled.');
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

    const { email, text } = body;

    if (!email || !text) {
        return NextResponse.json({ error: 'Missing required fields: email and text' }, { status: 400 });
    }

    try {
        // 1. Find user by email
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', email), limit(1));
        const userSnapshot = await getDocs(userQuery);

        if (userSnapshot.empty) {
            return NextResponse.json({ error: `User with email ${email} not found.` }, { status: 404 });
        }
        const userDoc = userSnapshot.docs[0];
        const userData = { id: userDoc.id, ...userDoc.data() } as AppUser;
        const { id: userId, podId } = userData;

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
            return NextResponse.json({ error: `No active competition found for pod ${podId}.` }, { status: 404 });
        }

        // 3. Parse text for hashtag and multiplier
        const hashtagMatch = text.match(/#(\w+)/);
        if (!hashtagMatch) {
            return NextResponse.json({ error: 'No achievement hashtag found in text.' }, { status: 400 });
        }
        const ruleNameFromHashtag = hashtagMatch[1];
        
        // Look for multipliers like x2, x 2, *2, * 2
        const multiplierMatch = text.match(/(?:x|\*)\s*(\d+)/i);
        const value = multiplierMatch ? parseInt(multiplierMatch[1], 10) : 1;

        if (isNaN(value) || value <= 0) {
            return NextResponse.json({ error: 'Invalid multiplier value.' }, { status: 400 });
        }

        // 4. Find the matching rule in the competition (case-insensitive)
        const rule = activeCompetition.rules.find(
            (r) => r.name.toLowerCase() === ruleNameFromHashtag.toLowerCase()
        );

        if (!rule || !rule.id) {
            return NextResponse.json({ error: `Rule matching hashtag #${ruleNameFromHashtag} not found in active competition.` }, { status: 404 });
        }

        if (rule.type !== 'numeric') {
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
            loggedAt: serverTimestamp() as Timestamp,
            loggedBy: 'api_workflow', // System identifier
        };

        const newLogDoc = await addDoc(collection(db, 'dailyAchievements'), logEntry);

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
