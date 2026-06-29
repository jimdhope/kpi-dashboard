export interface AgentScoreLog {
  ruleId: string | null;
  ruleEmoji: string | null;
  ruleTitle: string | null;
  value: number;
  isBonus: boolean;
}

export interface PodAgentStanding {
  rank: number;
  agentId: string;
  agentName: string;
  teamEmoji: string;
  teamName: string;
  score: number;
  dailyScore?: number;
  scoreLogs?: AgentScoreLog[];
  hasActivity?: boolean;
}

export interface RuleTargetProgress {
  emoji: string;
  title: string;
  achieved: number;
  target: number;
}

export interface PodStandingsForTeams {
  podId: string;
  podName: string;
  ruleTargets: RuleTargetProgress[];
  agents: PodAgentStanding[];
  hasWebhook: boolean;
}

export interface CompetitionTeamStanding {
  teamId: string;
  teamName: string;
  teamEmoji: string;
  totalScore: number;
  memberCount: number;
}

export interface DailyScoresCardData {
  competitionName: string;
  date: string;
  pods: PodStandingsForTeams[];
  teamStandings?: CompetitionTeamStanding[];
  hidePodName?: boolean;
  competitionRules?: Array<{ id: string; emoji: string | null; title: string }>;
}

/**
 * Normalize and sanitize an emoji for consistent rendering in Teams Adaptive Cards
 */
function sanitizeEmoji(emoji: string | null): string {
  if (!emoji) return '📝';
  
  // Normalize to NFC form (composed) for consistent encoding
  let normalized = emoji.normalize('NFC');
  
  // Remove any zero-width characters or control characters that might cause issues
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Ensure it's not empty after cleanup
  if (!normalized || normalized.length === 0) return '📝';
  
  return normalized;
}

/**
 * Convert score logs to emoji string (e.g., "✅✅✅☎️☎️😊💲")
 * Repeats each emoji based on its value (count)
 */
function scoreLogsToEmojis(scoreLogs: AgentScoreLog[]): string {
  if (!scoreLogs || scoreLogs.length === 0) {
    return '—';
  }
  
  // Check if this agent is marked as N/A (absent)
  const hasNA = scoreLogs.some(log => log.ruleId === 'na' || log.ruleTitle === 'N/A');
  if (hasNA) {
    return '❌';
  }
  
  // Repeat each emoji based on its value (count)
  return scoreLogs
    .map(log => {
      const emoji = sanitizeEmoji(log.ruleEmoji);
      const count = Math.max(1, log.value || 1); // Default to 1 if value is 0/undefined
      return emoji.repeat(Math.min(count, 10)); // Max 10 to prevent abuse
    })
    .join('');
}

/**
 * Build the key/legend section showing rule emojis and their meanings
 */
function buildKeySection(rules: Array<{ emoji: string | null; title: string | null }>): any[] {
  if (!rules || rules.length === 0) return [];
  
  const uniqueRules = rules.filter((r, i, arr) => 
    arr.findIndex(x => x.emoji === r.emoji) === i && r.emoji
  );
  
  if (uniqueRules.length === 0) return [];
  
  // Normalize emojis for consistency
  const keyText = uniqueRules
    .map(r => `${sanitizeEmoji(r.emoji)} = ${r.title || 'Unknown'}`)
    .join('    ');
  
  return [
    {
      type: "TextBlock",
      text: `📋 Key: ${keyText}    ❌ = Not Present`,
      size: "Small",
      wrap: true,
      isSubtle: true,
      spacing: "Small",
    },
  ];
}

/**
 * Build the daily pod targets section
 */
function buildPodTargetsSection(pod: PodStandingsForTeams): any[] {
  if (!pod.ruleTargets || pod.ruleTargets.length === 0) return [];
  
  const targetsText = pod.ruleTargets
    .map(rt => `${rt.emoji} - ${rt.title} ${rt.achieved}/${rt.target}`)
    .join(' | ');
  
  return [
    {
      type: "TextBlock",
      text: `🎯 Daily Targets: ${targetsText}`,
      weight: "Bolder",
      spacing: "Medium",
      size: "Small",
      wrap: true,
    },
  ];
}

/**
 * Build the competition standings section
 */
function buildStandingsSection(teamStandings: CompetitionTeamStanding[]): any[] {
  if (!teamStandings || teamStandings.length === 0) return [];
  
  // Build standings as a single line using team emojis: "🐸 Team: X pts | 🦊 Team: X pts | 🦁 Team: X pts"
  const standingsText = teamStandings
    .map((team) => {
      return `${team.teamEmoji} ${team.teamName}: ${team.totalScore} pts`;
    })
    .join(' | ');
  
  return [
    {
      type: "TextBlock",
      text: "Standings",
      weight: "Bolder",
      spacing: "Medium",
      size: "Small",
    },
    {
      type: "TextBlock",
      text: standingsText,
      spacing: "Small",
      wrap: true,
      size: "Small",
    },
  ];
}

/**
 * Build a single agent row for the table
 */
function buildAgentRow(agent: PodAgentStanding): any {
  const medal = agent.rank === 1 ? '🥇' : agent.rank === 2 ? '🥈' : agent.rank === 3 ? '🥉' : '';
  const emojis = scoreLogsToEmojis(agent.scoreLogs || []);
  
  return {
    type: "Container",
    items: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: `${agent.teamEmoji} ${medal}${agent.agentName}`,
                weight: "Bolder",
                wrap: true,
              },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: emojis,
                wrap: true,
                horizontalAlignment: "Center",
              },
            ],
          },
          {
            type: "Column",
            width: "auto",
            items: [
              {
                type: "TextBlock",
                text: `${agent.dailyScore ?? agent.score}`,
                weight: "Bolder",
                horizontalAlignment: "Right",
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildDailyScoresAdaptiveCard(data: DailyScoresCardData) {
  const body: any[] = [];
  
  // Header
  body.push({
    type: "TextBlock",
    text: "Daily Scores Update",
    size: "Large",
    weight: "Bolder",
    color: "Accent",
    wrap: true,
  });
  
  // Collect all unique rules for the key - prefer competition rules, fall back to scoreLogs
  let allRules: Array<{ emoji: string | null; title: string | null }> = [];
  
  // Use competition rules if available (the correct approach)
  if (data.competitionRules && data.competitionRules.length > 0) {
    allRules = data.competitionRules.map(r => ({
      emoji: r.emoji,
      title: r.title,
    }));
  } else {
    // Fallback: collect from scoreLogs (legacy behavior - may show wrong emojis)
    for (const pod of data.pods) {
      for (const agent of pod.agents) {
        if (agent.scoreLogs) {
          for (const log of agent.scoreLogs) {
            if (!allRules.find(r => r.emoji === log.ruleEmoji)) {
              allRules.push({ emoji: log.ruleEmoji, title: log.ruleTitle });
            }
          }
        }
      }
    }
  }

  // Add key section
  body.push(...buildKeySection(allRules));

  // Add spacing
  body.push({
    type: "TextBlock",
    text: " ",
    spacing: "Small",
  });

  // Pod sections
  for (const pod of data.pods) {
    // Pod header - skip if hidePodName is true (combined format) or only 1 pod
    const shouldHidePodName = data.hidePodName || (data.pods.length === 1);
    if (!shouldHidePodName) {
      body.push({
        type: "TextBlock",
        text: pod.podName,
        weight: "Bolder",
        spacing: "Medium",
        size: "Medium",
      });
    }

    // Table header
    body.push({
      type: "Container",
      style: "emphasis",
      items: [
        {
          type: "ColumnSet",
          columns: [
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: "Agent",
                  weight: "Bolder",
                  wrap: true,
                },
              ],
            },
            {
              type: "Column",
              width: "stretch",
              items: [
                {
                  type: "TextBlock",
                  text: "Activity",
                  weight: "Bolder",
                  horizontalAlignment: "Center",
                  wrap: true,
                },
              ],
            },
            {
              type: "Column",
              width: "auto",
              items: [
                {
                  type: "TextBlock",
                  text: "Pts",
                  weight: "Bolder",
                  horizontalAlignment: "Right",
                },
              ],
            },
          ],
        },
      ],
    });

    // Agent rows
    if (pod.agents.length === 0) {
      body.push({
        type: "TextBlock",
        text: "No activity today",
        isSubtle: true,
        spacing: "Small",
      });
    } else {
      for (const agent of pod.agents) {
        body.push(buildAgentRow(agent));
      }
    }

    // Pod targets
    body.push(...buildPodTargetsSection(pod));
  }

  // Competition standings
  if (data.teamStandings && data.teamStandings.length > 0) {
    body.push(...buildStandingsSection(data.teamStandings));
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
        },
      },
    ],
  };
}
