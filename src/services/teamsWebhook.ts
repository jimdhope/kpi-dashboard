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
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { format, startOfDay } from 'date-fns';

interface AgentScore {
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


// Helper function to generate the KPI key string
const generateKpiKey = (rules: RuleFormData[]): string => {
  return rules
    .map(rule => `${(rule.emoji && rule.emoji.trim() !== '') ? rule.emoji : '❓'} = ${rule.name} (${rule.points} pts)`)
    .join('  ');
};

// Helper function to generate the agent scores table (Markdown)
const generateAgentScoresTable = (agentScores: AgentScore[]): string => {
  if (agentScores.length === 0) return "No agent scores recorded for today.";
  let table = "- **Agent:** Achievements (Total Score)\n"; // Simple list format
  agentScores.forEach(score => {
    table += `- **${score.agentFirstName}:** ${score.emojiString || '-'} (${score.totalPoints} pts)\n`;
  });
  return table;
};

// Helper function to generate the pod targets summary string
const generatePodTargetsSummary = (podTargetSummary: PodTargetSummary[]): string => {
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
    agentScores: AgentScore[],
    podTargetSummary: PodTargetSummary[]
) => {
    console.log(`[sendTeamsUpdate] Triggered for Pod Name: ${podName}, Date: ${date.toISOString()}, Webhook URL Provided: ${!!webhookUrl}`);
    let currentStep = "Initial Checks";

    try { // Keep top-level try...catch
        if (!webhookUrl) {
            console.log(`[sendTeamsUpdate] No webhook URL provided for pod ${podName}. Skipping notification.`);
            throw new Error(`No webhook URL configured for pod ${podName}.`);
        }

        currentStep = "Formatting Data";
        const title = `Daily Scores - ${podName} (${format(date, 'PPP')})`;
        const kpiKey = generateKpiKey(rules);
        const kpiTable = generateAgentScoresTable(agentScores);
        const kpiTargets = generatePodTargetsSummary(podTargetSummary);

        // Construct the final payload for the Teams webhook
        // This payload uses Adaptive Card templating syntax
        const webhookPayload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": null,
                    "content": {
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "type": "AdaptiveCard",
                        "version": "1.6",
                        "body": [
                            {
                                "type": "TextBlock",
                                "size": "Medium",
                                "weight": "Bolder",
                                "text": "{{title}}" // Use data binding syntax
                            },
                            {
                                "type": "TextBlock",
                                "text": "{{kpiKey}}", // Use data binding syntax
                                "wrap": true,
                                "separator": true
                            },
                            {
                                "type": "TextBlock",
                                "text": "{{kpiTable}}", // Use data binding syntax
                                "wrap": true,
                                "separator": true
                            },
                            {
                                "type": "TextBlock",
                                "text": "{{kpiTargets}}", // Use data binding syntax
                                "wrap": true
                            }
                        ],
                        // Provide the data context using $data
                        "$data": {
                            "title": title,
                            "kpiKey": kpiKey,
                            "kpiTable": kpiTable,
                            "kpiTargets": kpiTargets
                        }
                    }
                }
            ]
        };

        currentStep = "Sending Webhook Request";
        console.log("[sendTeamsUpdate] Sending payload:", JSON.stringify(webhookPayload, null, 2));

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
        });
        console.log(`[sendTeamsUpdate] Webhook response status: ${response.status}, ok: ${response.ok}`);
        console.log("[sendTeamsUpdate] Full Response Headers:", response.headers); // Log all headers

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
