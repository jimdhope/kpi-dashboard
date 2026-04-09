"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface LeaderboardProps {
  competitionId: string;
  name: string;
  rankings: Array<{
    userId: string;
    userName: string;
    score: number;
    rank: number;
    isCurrent: boolean;
  }>;
}

export function LeaderboardCard({ competitionId, name, rankings }: LeaderboardProps) {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>Live leaderboard: {name}</CardTitle>
        <CardDescription>Ranking by total KPI points in the current period.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {rankings.length === 0 ? (
            <p className="text-sm text-muted-foreground w-full">No participants have logged data yet.</p>
          ) : (
            rankings.map((entry) => (
              <div 
                key={entry.userId} 
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  entry.isCurrent 
                    ? "bg-primary/10 border-primary/30" 
                    : "bg-glass/50 border-glass-border hover:bg-glass/80"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-glass border border-glass-border shadow-sm text-sm font-bold text-muted-foreground">
                     #{entry.rank}
                  </div>
                  <div className="font-medium text-foreground">
                     {entry.userName} {entry.isCurrent && <span className="text-primary italic text-sm ml-1">(You)</span>}
                  </div>
                </div>
                <div className="font-bold text-lg text-primary tracking-tight">
                   {entry.score.toLocaleString()} pts
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
