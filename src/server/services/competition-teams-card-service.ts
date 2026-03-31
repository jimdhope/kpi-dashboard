export interface PodAgentStanding {
  rank: number;
  agentId: string;
  agentName: string;
  score: number;
}

export interface PodStandingsForTeams {
  podId: string;
  podName: string;
  agents: PodAgentStanding[];
  hasWebhook: boolean;
}

export interface DailyScoresCardData {
  competitionName: string;
  date: string;
  pods: PodStandingsForTeams[];
}

export function buildDailyScoresAdaptiveCard(data: DailyScoresCardData) {
  const body: any[] = [
    {
      type: "TextBlock",
      size: "Large",
      weight: "Bolder",
      text: "Daily Scores Update",
      wrap: true,
      color: "Accent",
    },
    {
      type: "TextBlock",
      text: `${data.competitionName} - ${data.date}`,
      spacing: "Medium",
      size: "Medium",
    },
  ];

  for (const pod of data.pods) {
    body.push({
      type: "TextBlock",
      text: `🏆 ${pod.podName}`,
      weight: "Bolder",
      spacing: "Medium",
      size: "Medium",
    });

    if (pod.agents.length === 0) {
      body.push({
        type: "TextBlock",
        text: "No activity today",
        isSubtle: true,
        spacing: "Small",
      });
    } else {
      for (const agent of pod.agents) {
        const medal = agent.rank === 1 ? "🥇" : agent.rank === 2 ? "🥈" : agent.rank === 3 ? "🥉" : `${agent.rank}.`;
        body.push({
          type: "TextBlock",
          text: `${medal} ${agent.agentName} - ${agent.score} pts`,
          spacing: "Small",
          wrap: true,
        });
      }
    }
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
