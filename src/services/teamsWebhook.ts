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

// Function to format the message for Microsoft Teams using MessageCard format
const formatTeamsMessageCard = (
    podName: string,
    date: Date,
    rules: RuleFormData[],
    agentScores: AgentScoreForTeams[],
    podTargetSummary: PodTargetSummaryForTeams[]
): object => {
    console.log(`[formatTeamsMessageCard] Formatting message for Pod: ${podName}, Date: ${date.toISOString()}`);
    console.log("[formatTeamsMessageCard] Rules:", rules);
    console.log("[formatTeamsMessageCard] Agent Scores:", agentScores);
    console.log("[formatTeamsMessageCard] Pod Target Summary:", podTargetSummary);

    const formattedDate = format(date, 'PPPP');

    const ruleKeyString = rules
        .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} ${rule.name} (${rule.points} pts)`)
        .join('  \n'); // Use newline for better readability in Teams facts
    console.log("[formatTeamsMessageCard] Rule Key String:", ruleKeyString);

    let tableMarkdown = "";
    if (agentScores.length > 0) {
        tableMarkdown += "Agent Name | Achievements | Score\n";
        tableMarkdown += "---|---|---\n";
        agentScores.forEach(score => {
            // Replace pipes in emoji string to avoid breaking Markdown table
            const safeEmojiString = score.emojiString.replace(/\|/g, '');
            tableMarkdown += `${score.agentFirstName} | ${safeEmojiString || '-'} | **${score.totalPoints}**\n`;
        });
    } else {
        tableMarkdown = "_No scores logged today._";
    }
    console.log("[formatTeamsMessageCard] Table Markdown:", tableMarkdown);

    let podSummaryString = "";
    if (podTargetSummary.length > 0) {
        podSummaryString = podTargetSummary
            // Use newline for better readability in Teams text section
            .map(summary => `${summary.ruleEmoji} ${summary.ruleName} ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
            .join('  \n');
    } else {
        podSummaryString = "_No targets set for today._";
    }
    console.log("[formatTeamsMessageCard] Pod Summary String:", podSummaryString);

    const messageCard = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "summary": `KpiQuest Daily Scores for ${podName} - ${formattedDate}`,
        "themeColor": "008080", // Teal color
        "sections": [
            {
                "title": `**${podName} - Daily Scores (${formattedDate})**`,
                "facts": [
                    {
                        "name": "Rule Key:",
                        "value": ruleKeyString // Use formatted string with newlines
                    }
                ],
                "markdown": true
            },
            {
                "title": "**Agent Scores**",
                "text": tableMarkdown, // Use generated Markdown table
                "markdown": true
            },
            {
                "title": "**Pod Targets Today**",
                "text": podSummaryString, // Use generated summary string with newlines
                "markdown": true
            }
        ]
    };
    // Corrected log to show the actual object being returned
    console.log("[formatTeamsMessageCard] Generated MessageCard Payload:", messageCard);
    return messageCard;
};


// Updated function: Now accepts all necessary data as parameters
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

        currentStep = "Formatting MessageCard";
        // Ensure the variable is assigned correctly
        const messageCardPayload = formatTeamsMessageCard(podName, date, rules, agentScores, podTargetSummary);

        console.log(`[sendTeamsUpdate] Sending formatted MessageCard to webhook for pod ${podName}. URL: ${webhookUrl}`);

        currentStep = "Sending Webhook Request";
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
             // Use the assigned variable here
            body: JSON.stringify(messageCardPayload),
        });
        console.log(`[sendTeamsUpdate] Webhook response status: ${response.status}, ok: ${response.ok}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[sendTeamsUpdate] Failed to send webhook to Teams for pod ${podName}. Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Teams webhook failed with status ${response.status}: ${errorText}`);
        } else {
            console.log(`[sendTeamsUpdate] Successfully sent webhook update for pod ${podName}.`);
        }

    } catch (error: any) {
        console.error(`[sendTeamsUpdate] Error occurred during step "${currentStep}" for pod ${podName}:`, error);
        if (error instanceof Error && error.message.includes("Failed to fetch")) {
            console.error(`[sendTeamsUpdate] Network error calling Teams webhook during step "${currentStep}":`, error.message);
            throw new Error(`Network error calling Teams webhook: ${error.message}`);
        } else {
            throw error;
        }
    }
};
