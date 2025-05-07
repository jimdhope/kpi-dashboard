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
            // Ensure emojis don't contain characters that break markdown tables (like '|')
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
// Accepts podName and webhookUrl as arguments
export const sendTeamsUpdate = async (
    podId: string,
    date: Date,
    podName: string,
    webhookUrl: string
) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod ID: ${podId}, Date: ${date.toISOString()}, Pod Name: ${podName}, Webhook URL Provided: ${!!webhookUrl}`);
    let currentStep = "Initial Checks"; // Track current operation for error logging

    try {
        // 1. Initial Checks (Webhook URL already provided)
        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL provided for pod ${podName} (${podId}). Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        // 2. Find Active Competition and Rules
        currentStep = "Finding Active Competition";
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
             // Ensure endDate exists and is a Timestamp before comparing
             if (comp.endDate && comp.endDate instanceof Timestamp && comp.endDate.toDate() >= dateTimestamp) {
                 activeCompetition = comp;
                 break;
             }
        }

        if (!activeCompetition || !activeCompetition.id) {
            console.log(`[sendTeamsUpdate] No active competition found for pod ${podId} on ${date.toDateString()}. Skipping.`);
            return; // Exit gracefully if no competition found
        }
        const rules = activeCompetition.rules || [];
        const competitionId = activeCompetition.id;
        console.log(`[sendTeamsUpdate] Active Competition for pod ${podId}: ${competitionId}, Rules count: ${rules.length}`);

        // 3. Fetch Pod Agents
        currentStep = "Fetching Pod Agents";
        const usersRef = collection(db, 'users');
        const agentsQuery = query(usersRef, where('podId', '==', podId), where('roles', 'array-contains', 'agent'), orderBy('name'));
        const agentsSnapshot = await getDocs(agentsQuery);
        const agents = agentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        console.log(`[sendTeamsUpdate] Fetched ${agents.length} agents for pod ${podId}.`);

        // 4. Fetch Daily Logs for the Pod on the specific date for the active competition
        currentStep = `Fetching Daily Logs (Comp: ${competitionId}, Date: ${date.toDateString()})`;
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
        currentStep = "Fetching Daily Targets";
        const targetsDocId = `${competitionId}_${podId}`;
        const targetsDocRef = doc(db, 'dailyPodTargets', targetsDocId);
        const targetsDocSnap = await getDoc(targetsDocRef);
        const dailyTargetsData = targetsDocSnap.exists() ? targetsDocSnap.data() as DailyTargetData : null;
        console.log(`[sendTeamsUpdate] Daily targets data for ${targetsDocId} exists: ${targetsDocSnap.exists()}`, dailyTargetsData);


        // --- Process Data ---
        currentStep = "Processing Data";
        const scores: Record<string, Omit<AgentScore, 'agentId' | 'agentFirstName'>> = {};
        const ruleTotalsToday: Record<string, number> = {};
        rules.forEach(rule => { if(rule.id) ruleTotalsToday[rule.id] = 0; });

        dailyLogs.forEach(log => {
            // Ensure log points are valid numbers
            const pointsToAdd = typeof log.points === 'number' && !isNaN(log.points) ? log.points : 0;
             // Ensure log value is valid number for totals
             const valueToAdd = typeof log.value === 'number' && !isNaN(log.value) ? log.value : 0;

            if (!scores[log.agentId]) {
                scores[log.agentId] = { totalPoints: 0, emojiString: '' };
            }
            scores[log.agentId].totalPoints += pointsToAdd;

            if (ruleTotalsToday.hasOwnProperty(log.ruleId)) {
                ruleTotalsToday[log.ruleId] += valueToAdd;
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
                 // Ensure log value is a positive number before adding emoji
                 const logValue = logForRule && typeof logForRule.value === 'number' && !isNaN(logForRule.value) ? logForRule.value : 0;

                 if (logValue > 0) {
                    const emojiToUse = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';
                    emojis += emojiToUse.repeat(logValue); // Repeat emoji based on value
                }
            });
             // Initialize score if agent has no logs but exists in the pod
             if (!scores[agent.id]) {
                scores[agent.id] = { totalPoints: 0, emojiString: '' };
            }
             scores[agent.id].emojiString = emojis;
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
                // Only include if target is explicitly set for the day and >= 0
                if (targetValue === undefined || targetValue === null || targetValue < 0) return null;
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
        currentStep = "Formatting MessageCard";
        // Use the podName passed as an argument
        const messageCardPayload = formatTeamsMessageCard(podName, date, rules, finalAgentScores, finalPodTargetSummary);

        console.log(`[sendTeamsUpdate] Sending formatted MessageCard to webhook for pod ${podName}. URL: ${webhookUrl}`);
        // console.log("[sendTeamsUpdate] Payload being sent:", JSON.stringify(messageCardPayload, null, 2)); // Verbose logging

        currentStep = "Sending Webhook Request";
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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

    } catch (error: any) {
        // Log the specific step where the error occurred
        console.error(`[sendTeamsUpdate] Error occurred during step "${currentStep}" for pod ${podId}:`, error);

        // Check if it's a FirebaseError and specifically a permissions error
         if (error.name === 'FirebaseError' && error.code === 'permission-denied') {
             console.error(`[sendTeamsUpdate] Firestore Permission Denied: The server function lacks permission to read necessary data during step: "${currentStep}". Check Firestore rules.`);
              throw new Error(`Firestore Permission Denied during step: ${currentStep}. Check rules.`);
         } else if (error.message.includes("Failed to fetch")) {
              // Handle network-related errors when calling the webhook
              console.error(`[sendTeamsUpdate] Network error calling Teams webhook during step "${currentStep}":`, error.message);
              throw new Error(`Network error calling Teams webhook: ${error.message}`);
         } else {
            // Rethrow other errors
            throw error;
         }
    }
};
