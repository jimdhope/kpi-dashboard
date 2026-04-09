"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface PodComparisonProps {
  pods: Array<{
    id: string;
    name: string;
    dailyScore: number;
  }>;
}

export function PodComparison({ pods }: PodComparisonProps) {
  if (!pods || pods.length === 0) return null;

  const maxScore = Math.max(...pods.map(p => p.dailyScore), 10);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Pod Performance (Today)</CardTitle>
        <CardDescription>Live comparison of KPI generation across your pods.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5 mt-2">
          {pods.map(pod => {
            const percentage = Math.min((pod.dailyScore / maxScore) * 100, 100);
            return (
              <div key={pod.id} className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-foreground tracking-tight">{pod.name}</strong>
                  <span className="text-sm font-semibold text-primary">{pod.dailyScore.toLocaleString()} pts</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
