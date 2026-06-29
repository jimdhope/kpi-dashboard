"use client";

import React, { useState, useEffect, useCallback } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, TrendingDown, Filter, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Timeframe = "thisWeek" | "thisMonth" | "last6weeks" | "allTime";

interface Pod {
  id: string;
  name: string;
}

interface LeaderboardEntry {
  agentId: string;
  agentName: string;
  score: number;
  rank: number;
}

interface Leaderboard {
  tracker: { id: string; name: string; unit: string | null; sortOrder: "asc" | "desc" };
  entries: LeaderboardEntry[];
}

const PERF_POD_KEY = "performanceDashboard_selectedPodId";
const PERF_TF_KEY = "performanceDashboard_timeframe";

function generateInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const getMedalStyle = (rank: number) => {
  switch (rank) {
    case 1: return "bg-yellow-500/30 text-yellow-400 border-yellow-500/50";
    case 2: return "bg-gray-400/30 text-gray-300 border-gray-400/50";
    case 3: return "bg-orange-400/30 text-orange-400 border-orange-400/50";
    default: return "bg-muted/30 text-muted-foreground border-muted";
  }
};

export function PerformanceDashboard({ pods }: { pods: Pod[] }) {
  const [selectedPodId, setSelectedPodId] = useState<string>("all");
  const [timeframe, setTimeframe] = useState<Timeframe>("thisWeek");
  const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedPod = localStorage.getItem(PERF_POD_KEY);
    if (savedPod) setSelectedPodId(savedPod);
    const savedTf = localStorage.getItem(PERF_TF_KEY) as Timeframe | null;
    if (savedTf) setTimeframe(savedTf);
  }, []);

  const fetchLeaderboards = useCallback(async (podId: string, tf: Timeframe) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ podId, timeframe: tf });
      const res = await fetch(`/api/performance/leaderboards?${params}`);
      const data = await res.json();
      setLeaderboards(data);
    } catch {
      setLeaderboards([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboards(selectedPodId, timeframe);
  }, [selectedPodId, timeframe, fetchLeaderboards]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(PERF_POD_KEY, podId);
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf as Timeframe);
    localStorage.setItem(PERF_TF_KEY, tf);
  };

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case "thisWeek": return "This Week";
      case "thisMonth": return "This Month";
      case "last6weeks": return "Last 6 Weeks";
      case "allTime": return "All Time";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="grid gap-2">
                <Label>Pod</Label>
                <Select onValueChange={handlePodChange} value={selectedPodId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Pod" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pods</SelectItem>
                    {pods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Timeframe</Label>
                <Select onValueChange={handleTimeframeChange} value={timeframe}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thisWeek">This Week</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                    <SelectItem value="allTime">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/performance/log">
                <PlusCircle className="h-4 w-4 mr-2" />
                Log Scores
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {leaderboards.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No KPIs Configured</p>
              <p className="text-sm">Add trackers in the Settings to see leaderboards.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaderboards.map(({ tracker, entries }) => (
            <Card key={tracker.id} className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">
                        {tracker.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-base">{tracker.name}</CardTitle>
                      {tracker.unit && (
                        <span className="text-xs text-muted-foreground">{tracker.unit}</span>
                      )}
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    tracker.sortOrder === "asc"
                      ? "bg-blue-500/10 text-blue-500"
                      : "bg-green-500/10 text-green-500"
                  )}>
                    {tracker.sortOrder === "asc" ? (
                      <><TrendingDown className="h-3 w-3" /><span>Lower is better</span></>
                    ) : (
                      <><TrendingUp className="h-3 w-3" /><span>Higher is better</span></>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No data for {getTimeframeLabel()}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      <div
                        key={entry.agentId}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors",
                          entry.rank <= 3 ? "bg-muted/50" : "hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border",
                          getMedalStyle(entry.rank)
                        )}>
                          {entry.rank}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {generateInitials(entry.agentName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">
                            {entry.agentName}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            "font-bold tabular-nums",
                            entry.rank <= 3 ? "text-foreground" : "text-primary"
                          )}>
                            {entry.score.toLocaleString()}
                            {tracker.unit ? ` ${tracker.unit}` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {leaderboards.length > 0 && leaderboards.every((lb) => lb.entries.length === 0) && (
        <Card className="glass-card">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Filter className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No Data for {getTimeframeLabel()}</p>
              <p className="text-sm">No KPI logs recorded for the selected timeframe and pod.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
