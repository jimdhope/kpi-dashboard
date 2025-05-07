'use server';

import {
    collection,
    query,
    where,
    getDocs,
    Timestamp,
    doc,
    getDoc,
    orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { DailyTargetData } from '@/app/(admin)/admin/pod-targets/page';
import { format, startOfDay, getDay } from 'date-fns';

const daysOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

interface AgentScore {
    agentId: string;
    agentFirstName: string;
    totalPoints: number;
    emojiString: string;
}

interface PodTargetSummaryForTeams {
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
}


// Function to format the message for Microsoft Teams using MessageCard format
const formatTeamsMessageCard = (
    podName: string,
    date: Date,
    rules: RuleFormData[],
    agentScores: AgentScore[],
    podTargetSummary: PodTargetSummaryForTeams[]
): object => { // Return type is now object for the MessageCard
    console.log(`[formatTeamsMessageCard] Formatting message for Pod: ${podName}, Date: ${date.toISOString()}`);
    console.log("[formatTeamsMessageCard] Rules:", rules);
    console.log("[formatTeamsMessageCard] Agent Scores:", agentScores);
    console.log("[formatTeamsMessageCard] Pod Target Summary:", podTargetSummary);


    const formattedDate = format(date, 'PPPP'); // e.g., Monday, May 5th, 2025

    // 1. Rule Key
    const ruleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} ${rule.name} (${rule.points} pts)`)
        .join('  \n'); // Use newline for better readability in Teams MessageCard
    console.log("[formatTeamsMessageCard] Rule Key String:", ruleKeyString);

    // 2. Scores Table (Markdown)
    let tableMarkdown = "";
    if (agentScores.length > 0) {
        tableMarkdown += "Agent Name | Achievements | Score\n";
        tableMarkdown += "---|---|---\n"; // Markdown table header separator
        agentScores.forEach(score => {
            const safeEmojiString = score.emojiString.replace(/\|/g, '');
            tableMarkdown += `${score.agentFirstName} | ${safeEmojiString || '-'} | **${score.totalPoints}**\n`;
        });
    } else {
        tableMarkdown = "_No scores logged today._";
    }
    console.log("[formatTeamsMessageCard] Table Markdown:", tableMarkdown);

    // 3. Pod Target Summary
    let podSummaryString = "";
    if (podTargetSummary.length > 0) {
        podSummaryString = podTargetSummary
            .map(summary => `${summary.ruleEmoji} ${summary.ruleName} ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
            .join('  \n'); // Use newline for better readability
    } else {
        podSummaryString = "_No targets set for today._";
    }
    console.log("[formatTeamsMessageCard] Pod Summary String:", podSummaryString);

    // Construct the MessageCard payload
    const messageCard = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": `KpiQuest Daily Scores for ${podName} - ${formattedDate}`,
        "themeColor": "008080", // Teal color

        "sections": [
            {
                "title": `**${podName} - Daily Scores (${formattedDate})**`,
                "facts": [ // Using facts for a cleaner look in Teams if preferred
                    {
                        "name": "Rule Key:",
                        "value": ruleKeyString
                    }
                ],
                "markdown": true // Ensure markdown is enabled for this section if using text directly
            },
            {
                "title": "**Agent Scores**",
                "text": tableMarkdown, // Table is pure markdown
                "markdown": true
            },
            {
                "title": "**Pod Targets Today**",
                "text": podSummaryString,
                "markdown": true
            }
        ]
    };
    console.log("[formatTeamsMessageCard] Generated MessageCard Payload:", messageCard);
    return messageCard;
};

// Function to fetch all necessary data and send the webhook
export const sendTeamsUpdate = async (podId: string, date: Date) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod ID: ${podId}, Date: ${date.toISOString()}`);

    try {
        // 1. Fetch Pod Data (for Webhook URL and name)
        const podDocRef = doc(db, 'pods', podId);
        const podDocSnap = await getDoc(podDocRef);
        if (!podDocSnap.exists()) {
            console.warn(`[sendTeamsUpdate] Pod document ${podId} not found.`);
            throw new Error(`Pod with ID ${podId} not found.`);
        }
        const podData = podDocSnap.data() as Pod;
        const webhookUrl = podData.teamsWebhookUrl;
        const podName = podData.name;
        console.log(`[sendTeamsUpdate] Pod Data for ${podId}:`, { podName, webhookUrl });


        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL configured for pod ${podName} (${podId}). Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        // 2. Find Active Competition and Rules
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(date));
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', podId),
            where('startDate', '<=', dateTimestamp),
            orderBy('startDate', 'desc')
        );
        const competitionSnapshot = await getDocs(competitionQuery);
        let activeCompetition: Competition | null = null;
        for (const docSnap of competitionSnapshot.docs) {
             const comp = { id: docSnap.id, ...docSnap.data() } as Competition;
             if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= dateTimestamp) {
                 activeCompetition = comp;
                 break;
             }
        }

        if (!activeCompetition || !activeCompetition.id) {
            console.log(`[sendTeamsUpdate] No active competition found for pod ${podId} on ${date.toDateString()}. Skipping.`);
            // Not throwing an error here, as it might be valid that there's no competition.
            // The calling function can decide if this is an error or just a "no data to send" scenario.
            return;
        }
        const rules = activeCompetition.rules || [];
        const competitionId = activeCompetition.id;
        console.log(`[sendTeamsUpdate] Active Competition for pod ${podId}: ${competitionId}, Rules count: ${rules.length}`);

        // 3. Fetch Pod Agents
        const usersRef = collection(db, 'users');
        const agentsQuery = query(usersRef, where('podId', '==', podId), where('roles', 'array-contains', 'agent'), orderBy('name'));
        const agentsSnapshot = await getDocs(agentsQuery);
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        console.log(`[sendTeamsUpdate] Fetched ${agents.length} agents for pod ${podId}.`);

        // 4. Fetch Daily Logs for the Pod on the specific date for the active competition
        const achievementsRef = collection(db, 'dailyAchievements');
        const logsQuery = query(
            achievementsRef,
            where('podId', '==', podId),
            where('competitionId', '==', competitionId),
            where('date', '==', dateTimestamp)
        );
        const logsSnapshot = await getDocs(logsQuery);
        const dailyLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
        console.log(`[sendTeamsUpdate] Fetched ${dailyLogs.length} daily logs for pod ${podId}, competition ${competitionId}, date ${date.toDateString()}.`);

        // 5. Fetch Daily Targets
        const targetsDocId = `${competitionId}_${podId}`;
        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
        const targetsDocSnap = await getDoc(targetsDocRef);
        const dailyTargetsData = targetsDocSnap.exists() ? targetsDocSnap.data() as DailyTargetData : null;
        console.log(`[sendTeamsUpdate] Daily targets data for ${targetsDocId} exists: ${targetsDocSnap.exists()}`, dailyTargetsData);


        // --- Process Data (similar to daily-scores page logic) ---
        const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
        const ruleTotalsToday: Record<string, number> = {};
        rules.forEach(rule => { if(rule.id) ruleTotalsToday[rule.id] = 0; });

        dailyLogs.forEach(log => {
            if (!scores[log.agentId]) {
                scores[log.agentId] = { totalPoints: 0, emojiString: '' };
            }
            scores[log.agentId].totalPoints += log.points;
            if (ruleTotalsToday.hasOwnProperty(log.ruleId)) {
                ruleTotalsToday[log.ruleId] += log.value;
            }
        });

        agents.forEach(agent => {
            if (!agent.id) return;
            const agentLogs = dailyLogs.filter(log => log.agentId === agent.id);
            let emojis = '';
            const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));
            sortedRules.forEach(rule => {
                if (!rule.id) return;
                const logForRule = agentLogs.find(log => log.ruleId === rule.id);
                if (logForRule && logForRule.value > 0) {
                    const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                    emojis += emojiToUse.repeat(logForRule.value);
                }
            });
            if (scores[agent.id]) {
                scores[agent.id].emojiString = emojis;
            } else {
                scores[agent.id] = { totalPoints: 0, emojiString: '' };
            }
        });

        const finalAgentScores: AgentScore[] = agents
            .map(agent => {
                const agentScoreData = scores[agent.id!] || { totalPoints: 0, emojiString: '' };
                return {
                    agentId: agent.id!,
                    agentFirstName: agent.name.split(' ')[0] || agent.name,
                    totalPoints: agentScoreData.totalPoints,
                    emojiString: agentScoreData.emojiString,
                };
            })
            .sort((a, b) => a.agentFirstName.localeCompare(b.agentFirstName));
        console.log("[sendTeamsUpdate] Processed Agent Scores:", finalAgentScores);


        const dayOfWeek = daysOfWeek[getDay(date)];
        const finalPodTargetSummary: PodTargetSummaryForTeams[] = rules
            .map(rule => {
                if (!rule.id) return null;
                const targetValue = dailyTargetsData?.[rule.id]?.[dayOfWeek];
                // Only include if target is explicitly set for the day
                if (targetValue === undefined || targetValue === null) return null;
                const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                return {
                    ruleName: rule.name,
                    ruleEmoji: emojiToUse,
                    achieved: ruleTotalsToday[rule.id] || 0,
                    target: targetValue,
                };
            })
            .filter((item): item is PodTargetSummaryForTeams => item !== null)
            .sort((a, b) => a.ruleName.localeCompare(b.ruleName));
        console.log("[sendTeamsUpdate] Processed Pod Target Summary:", finalPodTargetSummary);


        // --- Format and Send ---
        const messageCardPayload = formatTeamsMessageCard(podName, date, rules, finalAgentScores, finalPodTargetSummary);

        console.log(`[sendTeamsUpdate] Sending formatted MessageCard to webhook for pod ${podName}. URL: ${webhookUrl}`);
        console.log("[sendTeamsUpdate] Payload being sent:", JSON.stringify(messageCardPayload, null, 2));


        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', // Correct content type for MessageCard
            },
            body: JSON.stringify(messageCardPayload),
        });
        console.log(`[sendTeamsUpdate] Webhook response status: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[sendTeamsUpdate] Failed to send webhook to Teams for pod ${podId}. Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Teams webhook failed with status ${response.status}: ${errorText}`);
        } else {
            console.log(`[sendTeamsUpdate] Successfully sent webhook update for pod ${podId}.`);
        }

    } catch (error) {
        console.error(`[sendTeamsUpdate] Error occurred while sending Teams update for pod ${podId}:`, error);
        throw error; // Re-throw the error so the calling function can catch it
    }
};

