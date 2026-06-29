export interface TrackerAgentScore {
  agentId: string;
  agentName: string;
  scores: Record<string, number>; // kpiId -> value
}

export interface TrackerScoresCardData {
  date: string;
  kpis: Array<{
    id: string;
    name: string;
    unit?: string;
  }>;
  agents: TrackerAgentScore[];
}

/**
 * Build Adaptive Card for tracker daily scores
 * Simple format: Agent | Value (for each KPI)
 */
export function buildTrackerScoresAdaptiveCard(data: TrackerScoresCardData): any {
  // Create rows for each agent using ColumnSet
  const agentRows = data.agents
    .sort((a, b) => a.agentName.localeCompare(b.agentName))
    .map(agent => {
      // Build KPI values string - just the number, not the name
      const kpiValues = data.kpis
        .map(kpi => String(agent.scores[kpi.id] || 0))
        .join('  |  ');
      
      return {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: agent.agentName,
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
                text: kpiValues,
                horizontalAlignment: "Right",
                wrap: true,
              },
            ],
          },
        ],
      };
    });

  const card = {
    type: "AdaptiveCard",
    version: "1.5",
    body: [
      // KPI header row
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
                isSubtle: true,
              },
            ],
          },
          {
            type: "Column",
            width: "stretch",
            items: [
              {
                type: "TextBlock",
                text: data.kpis.map(k => k.name).join('  |  '),
                weight: "Bolder",
                horizontalAlignment: "Right",
                isSubtle: true,
              },
            ],
          },
        ],
      },
      {
        type: "Container",
        items: agentRows.length > 0 ? agentRows : [
          {
            type: "TextBlock",
            text: "No achievements logged today",
            isSubtle: true,
          },
        ],
      },
    ],
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  };

  return card;
}