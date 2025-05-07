'use server';

import { format } from 'date-fns';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';

// Interface for agent scores passed TO this function
export interface AgentScoreForTeams {
    agentFirstName: string;
    totalPoints: number;
    emojiString: string;
}

// Interface for pod target summary passed TO this function
export interface PodTargetSummaryForTeams {
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
}


// Helper function to generate the KPI key string
const generateKpiKey = (rules: RuleFormData[]): string => {
  return rules
    .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
    .join('  \n'); // Use newline for better formatting in Teams
};

// Helper function to generate the agent scores table (Markdown for Teams)
const generateAgentScoresTable = (agentScores: AgentScoreForTeams[]): string => {
  if (agentScores.length === 0) return "No agent scores recorded for today.";
  // Use Markdown bullet points for better readability in Teams Adaptive Cards
  let list = "";
  agentScores.forEach(score => {
    const achievementsDisplay = score.emojiString && score.emojiString.trim() !== '' ? score.emojiString : '-';
    list += `- **${score.agentFirstName}:** ${achievementsDisplay} (${score.totalPoints} pts)\n`;
  });
  return list.trim(); // Trim trailing newline
};

// Helper function to generate the pod targets summary string
const generatePodTargetsSummary = (podTargetSummary: PodTargetSummaryForTeams[]): string => {
  if (podTargetSummary.length === 0) return "No pod targets set for today.";
  return podTargetSummary
    .map(summary => `${summary.ruleEmoji} ${summary.ruleName} ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
    .join(' | ');
};


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

        currentStep = "Formatting Data";
        // Calculate the actual values
        const title = `Daily Scores - ${podName} (${format(date, 'PPP')})`;
        const kpiKey = generateKpiKey(rules);
        const kpiTable = generateAgentScoresTable(agentScores);
        const kpiTargets = generatePodTargetsSummary(podTargetSummary);

        // Construct the payload with actual values embedded
        const webhookPayload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": null, // Required even if null
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.6", // Specify version
                        "body": [
                            {
                                "type": "TextBlock",
                                "size": "Medium",
                                "weight": "Bolder",
                                "text": title // Embed the actual title string
                            },
                            {
                                "type": "TextBlock",
                                "text": kpiKey, // Embed the actual kpiKey string
                                "wrap": true,
                                "separator": true,
                                "spacing": "Medium" // Add spacing
                            },
                            {
                                "type": "TextBlock",
                                "text": kpiTable, // Embed the actual kpiTable string
                                "wrap": true,
                                "separator": true,
                                "spacing": "Medium" // Add spacing
                            },
                            {
                                "type": "TextBlock",
                                "text": kpiTargets, // Embed the actual kpiTargets string
                                "wrap": true,
                                "spacing": "Medium" // Add spacing
                            }
                        ]
                    }
                }
            ]
        };


        currentStep = "Sending Webhook Request";
        // Log the final payload before sending
        console.log("[sendTeamsUpdate] Webhook Payload being sent:", JSON.stringify(webhookPayload, null, 2));

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
            throw new Error(`Failed to send message to Teams (Status: ${response.status}). Response: ${errorText}`);
        }

        console.log(`[sendTeamsUpdate] Successfully sent scores to Teams for pod ${podName}.`);

    } catch (error: any) {
        console.error(`[sendTeamsUpdate] Error during step "${currentStep}" for pod ${podName}:`, error);
        // Re-throw or handle the error appropriately for the UI
        throw new Error(`Error during Teams update (${currentStep}): ${error.message}`);
    }
};