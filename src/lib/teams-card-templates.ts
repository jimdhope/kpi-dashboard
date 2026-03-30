// Default card templates for Teams messages
// These provide the baseline variations that users can customize

export interface CardVariation {
  id: string;
  name: string;
  description: string;
  adaptiveCardJson: object;
}

export interface CardTemplate {
  category: string;
  variations: CardVariation[];
}

// Default templates for each category
export const DEFAULT_CARD_TEMPLATES: CardTemplate[] = [
  {
    category: "daily_summary",
    variations: [
      {
        id: "compact",
        name: "Compact",
        description: "Minimal daily summary with just the key metrics",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "{{title}}" },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ]
        }
      },
      {
        id: "detailed",
        name: "Detailed",
        description: "Full daily summary with all details",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: "{{title}}" },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "TextBlock", text: "Details", weight: "Bolder", spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ]
        }
      }
    ]
  },
  {
    category: "leaderboard",
    variations: [
      {
        id: "top5",
        name: "Top 5",
        description: "Show top 5 leaders",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: "{{title}}", wrap: true },
            { type: "TextBlock", text: "{{subtitle}}", wrap: true, spacing: "Medium" },
            { type: "Container", items: "{{#each entries}}" },
            { type: "TextBlock", text: "{{rank}}. {{name}} - {{value}}", wrap: true },
            { type: "Container", items: "{{/each}}" }
          ]
        }
      },
      {
        id: "user_focus",
        name: "User Focus",
        description: "Highlight current user's position",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: "{{title}}", wrap: true },
            { type: "TextBlock", text: "Your Position: #{{userRank}}", weight: "Bolder", spacing: "Medium" },
            { type: "FactSet", facts: [
              { title: "Rank", value: "#{{userRank}}" },
              { title: "Score", value: "{{userValue}}" }
            ]}
          ]
        }
      }
    ]
  },
  {
    category: "alert",
    variations: [
      {
        id: "warning",
        name: "Warning",
        description: "Yellow warning style alert",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "⚠️ {{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ],
          accentColor: "FFA500"
        }
      },
      {
        id: "critical",
        name: "Critical",
        description: "Red critical alert style",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "🚨 {{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ],
          accentColor: "FF0000"
        }
      },
      {
        id: "info",
        name: "Info",
        description: "Blue informational alert",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "ℹ️ {{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ],
          accentColor: "0078D4"
        }
      }
    ]
  },
  {
    category: "achievement",
    variations: [
      {
        id: "basic",
        name: "Basic",
        description: "Simple achievement notification",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: "🏆 {{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ]
        }
      },
      {
        id: "medal",
        name: "Medal Style",
        description: "Achievement with medal styling",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "ColumnSet", columns: [
              { type: "Column", width: "auto", items: [{ type: "TextBlock", text: "🥇", size: "Large" }] },
              { type: "Column", width: "stretch", items: [
                { type: "TextBlock", size: "Large", weight: "Bolder", text: "{{title}}", wrap: true },
                { type: "TextBlock", text: "{{message}}", wrap: true }
              ]}
            ]},
            { type: "FactSet", facts: "{{facts}}", spacing: "Medium" }
          ]
        }
      },
      {
        id: "trophy",
        name: "Trophy Style",
        description: "Celebration style with trophy",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Large", weight: "Bolder", text: "🎉 {{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "Image", url: "{{imageUrl}}", size: "Stretch", spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ],
          accentColor: "FFD700"
        }
      }
    ]
  },
  {
    category: "custom",
    variations: [
      {
        id: "simple",
        name: "Simple",
        description: "Basic custom message",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "{{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" }
          ]
        }
      },
      {
        id: "with_image",
        name: "With Image",
        description: "Custom message with optional image",
        adaptiveCardJson: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", size: "Medium", weight: "Bolder", text: "{{title}}", wrap: true },
            { type: "TextBlock", text: "{{message}}", wrap: true, spacing: "Medium" },
            { type: "Image", url: "{{imageUrl}}", size: "Stretch", spacing: "Medium" },
            { type: "FactSet", facts: "{{facts}}" }
          ]
        }
      }
    ]
  }
];

// Helper function to get default templates for a category
export function getDefaultTemplatesForCategory(category: string): CardVariation[] {
  const template = DEFAULT_CARD_TEMPLATES.find(t => t.category === category);
  return template?.variations ?? [];
}

// Helper function to get all default templates
export function getAllDefaultTemplates(): CardTemplate[] {
  return DEFAULT_CARD_TEMPLATES;
}
