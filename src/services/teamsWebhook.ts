
'use server';

import { format } from 'date-fns';
import type { RuleFormData } from '@/models/types';
import type { AppUser } from '@/services/user';
import type { TrackerKpi } from '@/app/(admin)/admin/trackers/setup/page';


// Interface for agent scores passed TO this function
export interface AgentScoreForTeams {
    agentFirstName: string;
    totalPoints: number;
    emojiString: string;
    isAbsent?: boolean;
    teamEmoji?: string;
    completedTasks?: { ruleName: string; ruleEmoji: string }[];
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

// Interface for tracker data
export interface TrackerData {
    agentName: string;
    achievements: {
        kpiName: string;
        value: number;
    }[];
}

// --- Internal Core Sender Function ---

/**
 * Sends a prepared Adaptive Card payload to a given Microsoft Teams webhook URL.
 * This is the single, internal function for all webhook communication to ensure consistency.
 * @param webhookUrl The URL of the Teams channel's incoming webhook.
 * @param payload The complete JSON payload for the webhook request.
 */
async function _sendToTeams(webhookUrl: string, payload: object) {
    if (!webhookUrl) {
        throw new Error("Webhook URL is not configured.");
    }
    
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': '', // Explicitly set Authorization to empty string
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TeamsWebhook] Failed to send webhook. Status: ${response.status}, Response: ${errorText}`);
        throw new Error(`Failed to send message to Teams (Status: ${response.status}). Response: ${errorText}`);
    }
}


// --- Helper Functions for Daily Data ---

const generateKpiKey = (rules: RuleFormData[]): string => {
  return rules
    .filter(rule => rule.type === 'numeric')
    .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'}=${rule.name}`)
    .join('  ');
};

const generateAgentScoresAdaptiveCardElements = (agentScores: AgentScoreForTeams[], taskRules: RuleFormData[]): any[] => {
    if (agentScores.length === 0) {
        return [{ type: "TextBlock", text: "No agent scores recorded for today.", wrap: true, spacing: "Medium" }];
    }

    const headerRow = {
        type: "ColumnSet",
        spacing: "Small",
        columns: [
            { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Agent", weight: "Bolder", wrap: true }] },
            { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Achievements", weight: "Bolder", wrap: true, horizontalAlignment: "Center" }] },
            { type: "Column", width: "auto", items: [{ type: "TextBlock", text: "Score", weight: "Bolder", wrap: true, horizontalAlignment: "Right" }] }
        ]
    };

    const agentRows = agentScores.map(score => {
        const taskEmojis = score.completedTasks?.map(t => t.ruleEmoji).join('') || '';
        const achievementsDisplay = score.isAbsent ? "N/A" : (`${score.emojiString || ''}${taskEmojis}`.trim() || '-');
        const scoreDisplay = score.isAbsent ? "N/A" : `${score.totalPoints.toLocaleString()}`;

        return {
            type: "ColumnSet",
            spacing: "Small",
            separator: true,
            columns: [
                { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: `${score.teamEmoji || ''} ${score.agentFirstName}`, wrap: true }] },
                { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: achievementsDisplay, wrap: true, horizontalAlignment: "Center"}] },
                { type: "Column", width: "auto", items: [{ type: "TextBlock", text: scoreDisplay, wrap: true, horizontalAlignment: "Right"}] }
            ]
        };
    });

    const taskKey = taskRules.map(rule => `${rule.emoji || '✅'}=${rule.name}`).join('  ');
    const taskKeyElement = taskKey ? { type: "TextBlock", text: `**Tasks:** ${taskKey}`, wrap: true, spacing: "Small", size: "Small" } : null;

    return [headerRow, ...agentRows, taskKeyElement].filter(Boolean);
};

const generatePodTargetsSummary = (podTargetSummary: PodTargetSummaryForTeams[]): string => {
  if (podTargetSummary.length === 0) return "";
  return podTargetSummary
    .map(summary => `${summary.ruleEmoji} ${summary.achieved.toLocaleString()}${summary.target !== null ? ` / ${summary.target.toLocaleString()}` : ''}`)
    .join('   |   ');
};


// --- Exposed Webhook Functions ---

/**
 * Sends the main daily scores update to Teams.
 * This function is confirmed to be working. It now uses the internal sender.
 */
export const sendTeamsUpdate = async (
    podName: string,
    webhookUrl: string,
    date: Date,
    rules: RuleFormData[],
    agentScoresForTeams: AgentScoreForTeams[],
    podTargetSummaryForTeams: PodTargetSummaryForTeams[],
    dailyTaskLogs: SimpleTaskLog[],
    teamBonusSummary: TeamBonusSummary[],
    teamTotalScores: TeamTotalScore[]
) => {
    try {
        const numericRules = rules.filter(r => r.type === 'numeric');
        const taskRules = rules.filter(r => r.type === 'checkbox');
        const kpiKeyText = generateKpiKey(numericRules);
        const teamStandingsText = `${teamTotalScores.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: **${s.totalPoints.toLocaleString()}**`).join(' | ')}`;
        const dailyBonusText = teamBonusSummary.length > 0
            ? `**Today's Adjustments:** ${teamBonusSummary.map(s => `${s.teamEmoji || '🏆'} ${s.teamName}: **${s.bonusPoints > 0 ? '+' : ''}${s.bonusPoints}**`).join(' | ')}`
            : null;
        const podTargetsText = podTargetSummaryForTeams.length > 0
            ? `**Pod Targets:** ${generatePodTargetsSummary(podTargetSummaryForTeams)}`
            : null;

        const cardBody = [
            {
                type: "TextBlock",
                text: `**Key:** ${kpiKeyText}`,
                wrap: true,
                spacing: "Medium",
                size: "Small"
            },
            {
                type: "Container",
                style: "emphasis",
                spacing: "Medium",
                items: generateAgentScoresAdaptiveCardElements(agentScoresForTeams, taskRules)
            },
            ...(podTargetsText ? [{ type: "TextBlock", text: podTargetsText, wrap: true, separator: true, spacing: "Medium" }] : []),
            {
                type: "TextBlock",
                text: `**Competition Standings:** ${teamStandingsText}`,
                wrap: true,
                separator: true,
                spacing: "Medium"
            },
             ...(dailyBonusText ? [{ type: "TextBlock", text: dailyBonusText, wrap: true, size: "Small", spacing: "Small" }] : [])
        ];
        
        const webhookPayload = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null, // This is important for Teams
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.4",
                        body: cardBody,
                    },
                },
            ],
        };

        await _sendToTeams(webhookUrl, webhookPayload);    
        console.log(`[sendTeamsUpdate] Successfully sent scores to Teams for pod ${podName}.`);

    } catch (error: any) {
        console.error(`[sendTeamsUpdate] Error for pod ${podName}:`, error);
        throw new Error(`Error during Teams update for daily scores: ${error.message}`);
    }
};

/**
 * Sends Tracker data to a Teams webhook.
 * This has been refactored to use the same sender logic as sendTeamsUpdate.
 */
export const sendTrackerDataToTeams = async (
    webhookUrl: string,
    date: Date,
    data: TrackerData[]
) => {
    if (data.length === 0) {
        throw new Error("No tracker data to send.");
    }

    try {
        const headerRow = {
            type: "ColumnSet",
            spacing: "Small",
            columns: [
                { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Agent", weight: "Bolder", wrap: true }] },
                { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: "Achievements", weight: "Bolder", wrap: true, horizontalAlignment: "Right" }] }
            ]
        };

        const agentRows = data.map(agentData => ({
            type: "ColumnSet",
            spacing: "Small",
            separator: true,
            columns: [
                { type: "Column", width: "stretch", items: [{ type: "TextBlock", text: agentData.agentName, wrap: true }] },
                { type: "Column", width: "stretch", items: [{ 
                    type: "TextBlock", 
                    text: agentData.achievements.map(ach => `${ach.kpiName}: **${ach.value}**`).join('  \n'),
                    wrap: true, 
                    horizontalAlignment: "Right" 
                }] }
            ]
        }));

        const cardBody = [
            {
                type: "TextBlock",
                text: `Tracker Results for ${format(date, 'PPP')}`,
                weight: "Bolder",
                size: "Medium",
            },
            {
                type: "Container",
                style: "emphasis",
                spacing: "Medium",
                items: [headerRow, ...agentRows]
            }
        ];

        const webhookPayload = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null, // Ensure this is included
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.4", // Match version
                        body: cardBody,
                    },
                },
            ],
        };

        await _sendToTeams(webhookUrl, webhookPayload);
        console.log(`[sendTrackerDataToTeams] Successfully sent tracker data to Teams.`);

    } catch (error: any) {
        console.error(`[sendTrackerDataToTeams] Error:`, error);
        throw new Error(`Error during Teams update for trackers: ${error.message}`);
    }
};
