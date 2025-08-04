
'use server';

import { format } from 'date-fns';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';

// Interface for agent scores passed TO this function
export interface AgentScoreForTeams {
    agentFirstName: string;
    totalPoints: number;
    emojiString: string;
    isAbsent?: boolean; // Added optional isAbsent flag
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
    .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`)
    .join('  ');
};

// New helper function to generate Adaptive Card elements for the agent scores table
const generateAgentScoresAdaptiveCardElements = (agentScores: AgentScoreForTeams[]): any[] => {
    if (agentScores.length === 0) {
        return [{ type: "TextBlock", text: "No agent scores recorded for today.", wrap: true, spacing: "Medium" }];
    }

    // Header Row
    const headerRow = {
        type: "ColumnSet",
        spacing: "Medium",
        columns: [
            {
                type: "Column",
                width: "stretch",
                items: [{ type: "TextBlock", text: "Agent", weight: "Bolder", wrap: true }]
            },
            {
                type: "Column",
                width: "stretch",
                items: [{ type: "TextBlock", text: "Achievements", weight: "Bolder", wrap: true, horizontalAlignment: "Center" }]
            },
            {
                type: "Column",
                width: "auto", // Adjust width as needed for points
                items: [{ type: "TextBlock", text: "Total Score", weight: "Bolder", wrap: true, horizontalAlignment: "Right" }]
            }
        ]
    };

    // Agent Data Rows
    const agentRows = agentScores.map(score => {
        const achievementsDisplay = score.isAbsent ? "N/A" : (score.emojiString && score.emojiString.trim() !== '' ? score.emojiString : '-');
        const scoreDisplay = score.isAbsent ? "N/A" : `${score.totalPoints} pts`;

        return {
            type: "ColumnSet",
            spacing: "Small", // Spacing between rows
            separator: true, // Adds a subtle line between rows
            columns: [
                {
                    type: "Column",
                    width: "stretch",
                    items: [{ type: "TextBlock", text: score.agentFirstName, wrap: true }]
                },
                {
                    type: "Column",
                    width: "stretch",
                    items: [{ type: "TextBlock", text: achievementsDisplay, wrap: true, horizontalAlignment: "Center"}]
                },
                {
                    type: "Column",
                    width: "auto",
                    items: [{ type: "TextBlock", text: scoreDisplay, wrap: true, horizontalAlignment: "Right"}]
                }
            ]
        };
    });

    return [headerRow, ...agentRows];
};


// Helper function to generate the pod targets summary string
const generatePodTargetsSummary = (podTargetSummary: PodTargetSummaryForTeams[]): string => {
  if (podTargetSummary.length === 0) return "No pod targets set for today.";
  return podTargetSummary
    .map(summary => `${summary.ruleEmoji} ${summary.ruleName}  ${summary.achieved}${summary.target !== null ? ` / ${summary.target}` : ''}`)
    .join(' | ');
};


export const sendTeamsUpdate = async (
    podName: string,
    webhookUrl: string,
    date: Date,
    rules: RuleFormData[],
    agentScoresForTeams: AgentScoreForTeams[],
    podTargetSummaryForTeams: PodTargetSummaryForTeams[]
) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod Name: ${podName}, Date: ${date.toISOString()}, Webhook URL Provided: ${!!webhookUrl}`);
    let currentStep = "Initial Checks";

    try {
        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL provided for pod ${podName}. Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        currentStep = "Formatting Data";
        const titleText = `Daily Scores - ${podName} (${format(date, 'PPP')})`; // Not used in card body directly anymore
        const kpiKeyText = generateKpiKey(rules);
        const kpiTargetsText = generatePodTargetsSummary(podTargetSummaryForTeams);

        // Construct the Adaptive Card body elements
        const adaptiveCardBodyElements = [
            {
                "type": "TextBlock",
                "text": kpiKeyText,
                "wrap": true,
                "spacing": "Medium"
            },
            // Insert the array of ColumnSet elements for the table
            ...generateAgentScoresAdaptiveCardElements(agentScoresForTeams),
            {
                "type": "TextBlock",
                "text": kpiTargetsText,
                "wrap": true,
                "separator": true,
                "spacing": "Medium"
            }
        ];

        const webhookPayload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": null, // Must be null if content is provided directly
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.4", // Keeping version 1.4
                        "body": adaptiveCardBodyElements
                    }
                }
            ]
        };


        currentStep = "Sending Webhook Request";
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
        throw new Error(`Error during Teams update (${currentStep}): ${error.message}`);
    }
};

