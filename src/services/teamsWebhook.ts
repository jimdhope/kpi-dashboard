// src/services/teamsWebhook.ts
'use server';

import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';

// Define types for data passed from the client
export interface AgentScoreForTeams {
    agentFirstName: string;
    emojiString: string;
    totalPoints: number;
}

export interface PodTargetSummaryForTeams {
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
}

// Function to format the data needed for the Adaptive Card
const formatDataForAdaptiveCard = (
    podName: string,
    date: Date,
    rules: RuleFormData[],
    agentScores: AgentScoreForTeams[],
    podTargetSummary: PodTargetSummaryForTeams[]
): { title: string; kpiKey: string; kpiTable: string; kpiTargets: string } => {
    console.log(`[formatDataForAdaptiveCard] Formatting data for Pod: ${podName}, Date: ${date.toISOString()}`);

    // 1. Set the title
    const title = `Daily Scores - ${podName} (${format(date, 'PPP')})`;

    // 2. Format the KPI Key
    const kpiKey = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
        .join('  \n'); // Use newline for better readability in Adaptive Card

    // 3. Format the KPI Table (Agent Scores)
    let kpiTable = "";
    if (agentScores.length > 0) {
        // Use Markdown-like formatting for text blocks
        kpiTable = agentScores.map(score => {
            const safeEmojiString = score.emojiString || '-';
            return `- **${score.agentFirstName}:** ${safeEmojiString} (${score.totalPoints} pts)`;
        }).join('  \n'); // Newline between agents
    } else {
        kpiTable = "_No scores logged today._";
    }

    // 4. Format the KPI Targets
    let kpiTargets = "";
    if (podTargetSummary.length > 0) {
        kpiTargets = podTargetSummary
            .map(summary => `${summary.ruleEmoji} ${summary.ruleName} ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
            .join(' | '); // Use pipe separator for targets line
    } else {
        kpiTargets = "_No targets set for today._";
    }

    const formattedData = { title, kpiKey, kpiTable, kpiTargets };
    console.log("[formatDataForAdaptiveCard] Generated Data:", formattedData);
    return formattedData;
};


// Function to send the Adaptive Card payload to Teams
export const sendTeamsUpdate = async (
    podName: string,
    webhookUrl: string,
    date: Date,
    rules: RuleFormData[],
    agentScores: AgentScoreForTeams[],
    podTargetSummary: PodTargetSummaryForTeams[]
) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod Name: ${podName}, Date: ${date.toISOString()}, Webhook URL Provided: ${!!webhookUrl}`);
    let currentStep = "Initial Checks";

    try {
        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL provided for pod ${podName}. Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        currentStep = "Formatting Data for Adaptive Card";
        const cardData = formatDataForAdaptiveCard(podName, date, rules, agentScores, podTargetSummary);

        currentStep = "Constructing Adaptive Card Payload";
        // Construct the Adaptive Card JSON using the correctly mapped data
        const adaptiveCardJson = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Medium",
                    "weight": "Bolder",
                    "text": cardData.title // Use the generated title
                },
                {
                    "type": "TextBlock",
                    "text": cardData.kpiKey, // Use the generated key string
                    "wrap": true,
                    "separator": true
                },
                {
                    "type": "TextBlock",
                    "text": cardData.kpiTable, // Use the generated table string
                    "wrap": true,
                    "separator": true
                },
                {
                    "type": "TextBlock",
                    "text": cardData.kpiTargets, // Use the generated targets string
                    "wrap": true
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.6"
        };

        // Construct the final payload for the Teams webhook
        const webhookPayload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": null,
                    "content": adaptiveCardJson
                }
            ]
        };

        console.log(`[sendTeamsUpdate] Sending Adaptive Card payload to webhook for pod ${podName}. URL: ${webhookUrl}`);
        console.log("[sendTeamsUpdate] Payload:", JSON.stringify(webhookPayload, null, 2));


        currentStep = "Sending Webhook Request";
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
        });
        console.log(`[sendTeamsUpdate] Webhook response status: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[sendTeamsUpdate] Failed to send webhook to Teams for pod ${podName}. Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Teams webhook failed with status ${response.status}: ${errorText}`);
        } else {
            const responseText = await response.text();
            console.log(`[sendTeamsUpdate] Successfully sent webhook update for pod ${podName}. Response: ${responseText}`);
        }

    } catch (error: any) {
        console.error(`[sendTeamsUpdate] Error occurred during step "${currentStep}" for pod ${podName}:`, error);
        throw error;
    }
};