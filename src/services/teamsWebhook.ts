
'use server';

import { format } from 'date-fns';
import type { RuleFormData } from '@/models/types';

// Interface for agent scores passed TO this function
export interface AgentScoreForTeams {
    agentFirstName: string;
    totalPoints: number;
    emojiString: string;
    isAbsent?: boolean;
    completedTasks?: { ruleName: string; ruleEmoji: string }[]; // New field for tasks
    targetProgress?: string;
}

// Interface for pod target summary passed TO this function
export interface PodTargetSummaryForTeams {
    ruleName: string;
    ruleEmoji: string;
    achieved: number;
    target: number | null;
}

// Interface for a simplified, serializable task log
export interface SimpleTaskLog {
    agentId: string;
    taskId: string;
}

// Interface for daily bonus summary
export interface TeamBonusSummary {
    teamName: string;
    teamEmoji?: string;
    bonusPoints: number;
}

// Interface for team total scores
export interface TeamTotalScore {
    teamName: string;
    teamEmoji?: string;
    totalPoints: number;
}


// Helper function to generate the KPI key string
const generateKpiKey = (rules: RuleFormData[]): string => {
  return rules
    .filter(rule => rule.type === 'numeric') // Only include numeric rules in the key
    .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`)
    .join('  ');
};

// Updated helper function to generate Adaptive Card elements for the agent scores table
const generateAgentScoresAdaptiveCardElements = (agentScores: AgentScoreForTeams[], taskRules: RuleFormData[]): any[] => {
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
                items: [{ type: "TextBlock", text: "Progress", weight: "Bolder", wrap: true, horizontalAlignment: "Center" }]
            },
            {
                type: "Column",
                width: "auto", // Adjust width as needed for points
                items: [{ type: "TextBlock", text: "Score", weight: "Bolder", wrap: true, horizontalAlignment: "Right" }]
            }
        ]
    };

    // Agent Data Rows
    const agentRows = agentScores.map(score => {
        // Combine numeric emojis with task emojis
        const taskEmojis = score.completedTasks?.map(t => t.ruleEmoji).join('') || '';
        const allAchievements = `${score.emojiString || ''}${taskEmojis}`;
        const progressDisplay = score.isAbsent ? "N/A" : (score.targetProgress || allAchievements.trim() || '-');
        const scoreDisplay = score.isAbsent ? "N/A" : `${score.totalPoints} pts`;

        return {
            type: "ColumnSet",
            spacing: "Small", // Spacing between rows
            separator: true, // Adds a subtle line between rows
            columns: [
                {
                    type: "Column",
                    width: "stretch",
                    items: [{ type: "TextBlock", text: `${score.teamEmoji || ''} ${score.agentFirstName}`, wrap: true }]
                },
                {
                    type: "Column",
                    width: "stretch",
                    items: [{ type: "TextBlock", text: progressDisplay, wrap: true, horizontalAlignment: "Center"}]
                },
                {
                    type: "Column",
                    width: "auto",
                    items: [{ type: "TextBlock", text: scoreDisplay, wrap: true, horizontalAlignment: "Right"}]
                }
            ]
        };
    });

     const taskKey = taskRules.map(rule => `${rule.emoji || '✅'}=${rule.name}`).join('  ');
     const taskKeyElement = taskKey ? { type: "TextBlock", text: `Tasks: ${taskKey}`, wrap: true, spacing: "Small", size: "Small" } : null;

    return [headerRow, ...agentRows, taskKeyElement].filter(Boolean);
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
    podTargetSummaryForTeams: PodTargetSummaryForTeams[],
    dailyTaskLogs: SimpleTaskLog[], // Changed to accept simplified task logs
    teamBonusSummary: TeamBonusSummary[],
    teamTotalScores: TeamTotalScore[]
) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod Name: ${podName}, Date: ${date.toISOString()}, Webhook URL Provided: ${!!webhookUrl}`);
    let currentStep = "Initial Checks";

    try {
        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL provided for pod ${podName}. Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        currentStep = "Formatting Data";
        const numericRules = rules.filter(r => r.type === 'numeric');
        const taskRules = rules.filter(r => r.type === 'checkbox');
        const kpiKeyText = generateKpiKey(numericRules);

        // Generate team standings text
        const teamStandingsText = `**Current Standings:** ${teamTotalScores.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: **${s.totalPoints.toLocaleString()} pts**`).join(' | ')}`;

        // Generate daily bonus text if applicable
        const dailyBonusText = teamBonusSummary.length > 0
            ? `**Today's Adjustments:** ${teamBonusSummary.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: **${s.bonusPoints > 0 ? '+' : ''}${s.bonusPoints} pts**`).join(' | ')}`
            : null;

        // Construct the Adaptive Card body elements
        const adaptiveCardBodyElements = [
             {
                "type": "TextBlock",
                "text": `**Daily Scores for ${podName} - ${format(date, "PPP")}**`,
                "wrap": true,
                "size": "Large",
                "weight": "Bolder"
            },
            {
                "type": "TextBlock",
                "text": `**Key:** ${kpiKeyText}`,
                "wrap": true,
                "spacing": "Medium",
                "size": "Small"
            },
            // Insert the array of ColumnSet elements for the table
            ...generateAgentScoresAdaptiveCardElements(agentScoresForTeams, taskRules),
            // Add team standings and bonuses at the end
            {
                "type": "Container",
                "separator": true,
                "spacing": "Medium",
                "style": "emphasis",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": teamStandingsText,
                        "wrap": true
                    },
                     ...(dailyBonusText ? [{ "type": "TextBlock", "text": dailyBonusText, "wrap": true, "size": "Small", "spacing": "Small" }] : [])
                ]
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
