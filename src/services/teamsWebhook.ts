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

interface PodTargetSummary {
    ruleId: string;
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
}

// Helper function to get agent names
const getAgentNames = async (agentIds: string[]): Promise<Map<string, string>> => {
    const names = new Map<string, string>();
    if (agentIds.length === 0) return names;

    // Fetch users in batches if necessary, but for typical pod sizes, fetching all might be okay.
    // Consider batching if you expect very large pods.
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('__name__', 'in', agentIds)); // Query by document ID
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        names.set(doc.id, (doc.data() as AppUser).name || 'Unknown Agent');
    });
    return names;
}


// Function to format the message for Microsoft Teams
const formatTeamsMessage = (
    podName: string,
    date: Date,
    rules: RuleFormData[],
    agentScores: AgentScore[],
    podTargetSummary: PodTargetSummary[]
): string => {

    // 1. Header
    const formattedDate = format(date, 'PPPP'); // e.g., Monday, May 5th, 2025
    let message = `**${podName} - Daily Scores Update (${formattedDate})**\n\n---\n\n`;

    // 2. Rule Key
    const ruleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
        .join('  |  '); // Use double space | double space for better separation in Teams Markdown
    message += `**Key:** ${ruleKeyString}\n\n---\n\n`;

    // 3. Scores Table (Simple Markdown)
    if (agentScores.length > 0) {
        message += "**Agent Scores:**\n";
        // Header Row
        message += "| Agent | Achievements | Score |\n";
        message += "|---|---|---|\n";
        // Data Rows
        agentScores.forEach(score => {
             // Replace vertical pipe if present in emoji string to avoid breaking Markdown table
            const safeEmojiString = score.emojiString.replace(/\|/g, '');
            message += `| ${score.agentFirstName} | ${safeEmojiString || '-'} | **${score.totalPoints}** |\n`;
        });
        message += "\n---\n\n"; // Separator after table
    } else {
        message += "**Agent Scores:**\n_No scores logged today._\n\n---\n\n";
    }


    // 4. Pod Target Summary
    if (podTargetSummary.length > 0) {
        const podSummaryString = podTargetSummary
            .map(summary => `${summary.ruleEmoji} ${summary.ruleName} ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
            .join('  |  '); // Use double space | double space
        message += `**Pod Targets Today:** ${podSummaryString}\n\n`;
    } else {
         message += `**Pod Targets Today:** _No targets set for today._\n\n`;
    }

    return message;
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
            return;
        }
        const podData = podDocSnap.data() as Pod;
        const webhookUrl = podData.teamsWebhookUrl;
        const podName = podData.name;

        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL configured for pod ${podName} (${podId}). Skipping notification.`);
            return;
        }

        // 2. Find Active Competition and Rules
        const competitionsRef = collection(db, 'competitions');
        const dateTimestamp = Timestamp.fromDate(startOfDay(date));
        const competitionQuery = query(
            competitionsRef,
            where('podIds', 'array-contains', podId),
            where('startDate', '<=', dateTimestamp),
            orderBy('startDate', 'desc')
            // Filter for endDate >= dateTimestamp client-side or in a more complex query if needed
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
            return;
        }
        const rules = activeCompetition.rules || [];
         const competitionId = activeCompetition.id; // Get competition ID

        // 3. Fetch Pod Agents
        const usersRef = collection(db, 'users');
        const agentsQuery = query(usersRef, where('podId', '==', podId), where('roles', 'array-contains', 'agent'), orderBy('name'));
        const agentsSnapshot = await getDocs(agentsQuery);
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        const agentNameMap = new Map(agents.map(agent => [agent.id!, agent.name]));

        // 4. Fetch Daily Logs for the Pod on the specific date
        const achievementsRef = collection(db, 'dailyAchievements');
        const logsQuery = query(
            achievementsRef,
            where('podId', '==', podId),
            where('competitionId', '==', competitionId), // Filter by active competition
            where('date', '==', dateTimestamp)
        );
        const logsSnapshot = await getDocs(logsQuery);
        const dailyLogs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));


        // 5. Fetch Daily Targets
        const targetsDocId = `${competitionId}_${podId}`;
        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
        const targetsDocSnap = await getDoc(targetsDocRef);
        const dailyTargets = targetsDocSnap.exists() ? targetsDocSnap.data() as DailyTargetData : null;

        // --- Process Data (similar to daily-scores page logic) ---

        const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
        const ruleTotals: Record<string, number> = {};
        rules.forEach(rule => { if(rule.id) ruleTotals[rule.id] = 0; });

        dailyLogs.forEach(log => {
            // Agent Scores
            if (!scores[log.agentId]) {
                scores[log.agentId] = { totalPoints: 0, emojiString: '' };
            }
            scores[log.agentId].totalPoints += log.points;

            // Rule Totals for Pod Summary
            if (ruleTotals.hasOwnProperty(log.ruleId)) {
                ruleTotals[log.ruleId] += log.value;
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
                scores[agent.id] = { totalPoints: 0, emojiString: '' }; // Ensure entry exists
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

        // Build Pod Target Summary
        const dayOfWeek = daysOfWeek[getDay(date)];
        const finalPodTargetSummary: PodTargetSummary[] = rules
            .map(rule => {
                if (!rule.id) return null;
                const targetValue = dailyTargets?.[rule.id]?.[dayOfWeek];
                if (targetValue === undefined || targetValue === null) return null;
                const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                return {
                    ruleId: rule.id,
                    ruleName: rule.name,
                    ruleEmoji: emojiToUse,
                    achieved: ruleTotals[rule.id] || 0,
                    target: targetValue,
                };
            })
            .filter((item): item is PodTargetSummary => item !== null)
            .sort((a, b) => a.ruleName.localeCompare(b.ruleName));

        // --- Format and Send ---

        const messageContent = formatTeamsMessage(podName, date, rules, finalAgentScores, finalPodTargetSummary);

        console.log(`[sendTeamsUpdate] Sending formatted message to webhook for pod ${podName}`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: messageContent }), // Send as simple text/markdown
            // For Adaptive Cards, use 'application/adaptivecard+json' and structure accordingly
            // body: JSON.stringify({
            //     type: 'message',
            //     attachments: [{
            //         contentType: 'application/vnd.microsoft.card.adaptive',
            //         content: { /* Adaptive Card JSON structure here */ }
            //     }]
            // })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[sendTeamsUpdate] Failed to send webhook to Teams for pod ${podId}. Status: ${response.status}, Response: ${errorText}`);
            // Optionally notify admin via toast or other means
        } else {
            console.log(`[sendTeamsUpdate] Successfully sent webhook update for pod ${podId}.`);
        }

    } catch (error) {
        console.error(`[sendTeamsUpdate] Error occurred while sending Teams update for pod ${podId}:`, error);
        // Handle error appropriately (e.g., log it, notify admin)
    }
};
