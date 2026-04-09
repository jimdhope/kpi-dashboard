"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Common variables for Teams message templates
export const MESSAGE_VARIABLES = [
  { code: "{{agentName}}", label: "Agent Name", description: "Agent's display name" },
  { code: "{{agentEmail}}", label: "Agent Email", description: "Agent's email address" },
  { code: "{{agentScore}}", label: "Agent Score", description: "Current score value" },
  { code: "{{agentRank}}", label: "Agent Rank", description: "Leaderboard position" },
  { code: "{{competitionName}}", label: "Competition", description: "Competition name" },
  { code: "{{competitionGoal}}", label: "Competition Goal", description: "Target to achieve" },
  { code: "{{podName}}", label: "Pod Name", description: "Pod name" },
  { code: "{{achievementName}}", label: "Achievement", description: "Achievement earned" },
  { code: "{{achievementBadge}}", label: "Achievement Badge", description: "Badge/emoji for achievement" },
  { code: "{{date}}", label: "Date", description: "Current date" },
  { code: "{{time}}", label: "Time", description: "Current time" },
  { code: "{{totalScore}}", label: "Total Score", description: "Cumulative score" },
  { code: "{{changeScore}}", label: "Score Change", description: "Change in score" },
  { code: "{{leaderboard}}", label: "Leaderboard", description: "Table of top agents ranked by score" },
  { code: "{{teamStandings}}", label: "Team Standings", description: "Teams ranked by combined score" },
  { code: "{{podStandings}}", label: "Pod Standings", description: "Pods ranked by combined score" },
] as const;

interface VariablePillsProps {
  variables?: readonly { code: string; label: string; description: string }[];
  onInsert?: (code: string) => void;
  onSelect?: (code: string) => void;
  className?: string;
  compact?: boolean;
}

export function VariablePills({ variables = MESSAGE_VARIABLES, onInsert, onSelect, className, compact }: VariablePillsProps) {
  const handleClick = (code: string) => {
    if (onInsert) onInsert(code);
    if (onSelect) onSelect(code);
  };
  
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {!compact && <span className="text-xs text-muted-foreground mr-1 self-center">Insert:</span>}
      {variables.map((variable) => (
        <Button
          key={variable.code}
          type="button"
          variant="outline"
          size="sm"
          className={cn("font-mono", compact ? "h-5 text-xs px-1.5 py-0" : "h-6 text-xs px-2 py-0")}
          onClick={() => handleClick(variable.code)}
          title={variable.description}
        >
          {compact ? variable.code.replace(/\{\{|\}\}/g, "") : variable.label}
        </Button>
      ))}
    </div>
  );
}

// Hook to handle inserting variables into textareas
export function useTextareaWithVariables(
  value: string,
  onChange: (value: string) => void
) {
  const insertAtCursor = (textToInsert: string) => {
    onChange(value + textToInsert);
  };

  return { insertAtCursor };
}
