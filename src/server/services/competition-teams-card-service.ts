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
  scoreLogs?: AgentScoreLog[];
  hasActivity?: boolean;
}

export interface PodStandingsForTeams {
  podId: string;
  podName: string;
  dailyTarget: number | null;
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
}

/**
 * Convert score logs to emoji string (e.g., "✅✅✅☎️☎️😊💲")
 */
function scoreLogsToEmojis(scoreLogs: AgentScoreLog[]): string {
  if (!scoreLogs || scoreLogs.length === 0) {
    return '—';
  }
  
  return scoreLogs.map(log => log.ruleEmoji || '📝').join('');
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
  
  const keyText = uniqueRules
    .map(r => `${r.emoji || '📝'} = ${r.title || 'Unknown'}`)
    .join('    ');
  
  return [
    {
      type: "TextBlock",
      text: `📋 Key: ${keyText}`,
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
  if (!pod.dailyTarget) return [];
  
  return [
    {
      type: "TextBlock",
      text: `🎯 Daily Pod Target: ${pod.dailyTarget} points`,
      weight: "Bolder",
      spacing: "Medium",
      size: "Medium",
    },
  ];
}

/**
 * Build the competition standings section
 */
function buildStandingsSection(teamStandings: CompetitionTeamStanding[]): any[] {
  if (!teamStandings || teamStandings.length === 0) return [];
  
  const standingsText = teamStandings
    .map((team, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      return `${medal} ${team.teamEmoji} ${team.teamName}: ${team.totalScore} pts`;
    })
    .join('\n');
  
  return [
    {
      type: "TextBlock",
      text: "🏆 Competition Standings",
      weight: "Bolder",
      spacing: "Medium",
      size: "Medium",
    },
    {
      type: "TextBlock",
      text: standingsText,
      spacing: "Small",
      wrap: true,
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
                text: `${agent.score}`,
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
    text: "📊 Daily Scores Update",
    size: "Large",
    weight: "Bolder",
    color: "Accent",
    wrap: true,
  });
  
  body.push({
    type: "TextBlock",
    text: `${data.competitionName} - ${data.date}`,
    spacing: "Medium",
    size: "Medium",
  });

  // Collect all unique rules for the key
  const allRules: Array<{ emoji: string | null; title: string | null }> = [];
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
    // Pod header
    body.push({
      type: "TextBlock",
      text: `🏅 ${pod.podName}`,
      weight: "Bolder",
      spacing: "Medium",
      size: "Medium",
    });

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
