"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Target, Medal, PlusCircle, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { CompetitionRecord } from "@/lib/contracts";
import { useCompetitionScoreRefresh } from "@/hooks/use-competition-score-refresh";

interface StandingEntry {
  id: string;
  name: string;
  emoji?: string;
  score: number;
}

interface CompetitionStandings {
  competitionId: string;
  podStandings: StandingEntry[];
  teamStandings: StandingEntry[];
  agentStandings: (StandingEntry & { isCurrentUser?: boolean })[];
  ruleSummaries: { ruleId: string; title: string; totalValue: number; totalPoints: number }[];
}

const COMP_DASH_POD_KEY = "competitionDashboard_selectedPodId";

function MedalIcon({ index }: { index: number }) {
  if (index > 2) return <span className="font-bold text-sm">{index + 1}</span>;
  return (
    <Medal className={cn("h-5 w-5", index === 0 && "text-yellow-400", index === 1 && "text-gray-300", index === 2 && "text-orange-400")} />
  );
}

function StandingsTable({ entries, showEmoji, currentUserId }: {
  entries: (StandingEntry & { isCurrentUser?: boolean })[];
  showEmoji?: boolean;
  currentUserId?: string;
}) {
  if (entries.length === 0) return <p className="text-center text-muted-foreground py-4">No data</p>;
  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{showEmoji ? "Team" : "Name"}</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 20).map((entry, i) => (
              <TableRow key={entry.id} className={entry.isCurrentUser ? "bg-primary/10" : ""}>
                <TableCell className="font-bold"><MedalIcon index={i} /></TableCell>
                <TableCell className={cn("font-medium", entry.isCurrentUser && "text-primary")}>
                  {showEmoji && entry.emoji && <span className="mr-1">{entry.emoji}</span>}
                  {entry.isCurrentUser ? "You" : entry.name}
                </TableCell>
                <TableCell className={cn("text-right font-bold", entry.isCurrentUser && "text-primary")}>
                  {entry.score.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile */}
      <div className="md:hidden space-y-2 max-h-[300px] overflow-y-auto">
        {entries.slice(0, 20).map((entry, i) => (
          <div key={entry.id} className={cn("flex items-center justify-between p-2 rounded-lg", entry.isCurrentUser ? "bg-primary/10" : "bg-muted/30")}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                i === 0 && "bg-yellow-400/30 text-yellow-400",
                i === 1 && "bg-gray-400/30 text-gray-300",
                i === 2 && "bg-orange-400/30 text-orange-400",
                i > 2 && "bg-muted text-muted-foreground"
              )}>
                {i < 3 ? <Medal className="h-3 w-3" /> : i + 1}
              </div>
              {showEmoji && entry.emoji && <span>{entry.emoji}</span>}
              <span className={cn("font-medium text-sm truncate", entry.isCurrentUser && "text-primary")}>
                {entry.isCurrentUser ? "You" : entry.name}
              </span>
            </div>
            <span className={cn("font-bold text-sm shrink-0 ml-2", entry.isCurrentUser ? "text-primary" : "text-foreground")}>
              {entry.score.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function CompetitionsDashboard({
  competitions,
  currentUserId,
}: {
  competitions: CompetitionRecord[];
  currentUserId: string;
}) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(competitions[0]?.id ?? "");
  const [selectedPodId, setSelectedPodId] = useState("all");
  const [standings, setStandings] = useState<CompetitionStandings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COMP_DASH_POD_KEY);
    if (saved) setSelectedPodId(saved);
  }, []);

  const fetchStandings = useCallback(async (compId: string) => {
    if (!compId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/competitions/${compId}/standings`);
      if (res.ok) setStandings(await res.json());
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchStandings(selectedCompetitionId);
  }, [selectedCompetitionId, fetchStandings]);

  useCompetitionScoreRefresh(selectedCompetitionId, () => fetchStandings(selectedCompetitionId));

  const competition = competitions.find((c) => c.id === selectedCompetitionId) ?? null;

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    if (podId === "all") localStorage.removeItem(COMP_DASH_POD_KEY);
    else localStorage.setItem(COMP_DASH_POD_KEY, podId);
  };

  if (competitions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Trophy className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Competitions Yet</h2>
        <p className="text-muted-foreground">Create a competition to get started.</p>
        <Button asChild>
          <Link href="/competitions/manage"><PlusCircle className="h-4 w-4 mr-2" />Create Competition</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Selectors */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedCompetitionId} onValueChange={setSelectedCompetitionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/competitions/log">
              <LogIn className="h-4 w-4 mr-2" />Log Achievement
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/competitions/manage">
              <PlusCircle className="h-4 w-4 mr-2" />Manage
            </Link>
          </Button>
        </div>
      </div>

      {/* Date range */}
      {competition?.startsAt && competition?.endsAt && (
        <p className="text-sm text-muted-foreground">
          {format(new Date(competition.startsAt), "MMM d")} – {format(new Date(competition.endsAt), "MMM d, yyyy")}
        </p>
      )}

      {/* Rule Summary Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : standings?.ruleSummaries && standings.ruleSummaries.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {standings.ruleSummaries.map(({ ruleId, title, totalValue, totalPoints }) => (
            <Card key={ruleId} className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  <span className="truncate">{title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">{totalPoints.toLocaleString()} points</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Standings Grid */}
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pod Standings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Pod Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StandingsTable entries={standings?.podStandings ?? []} />
            </CardContent>
          </Card>

          {/* Team Standings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Team Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {competition?.teams.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No teams configured</p>
              ) : (
                <StandingsTable entries={standings?.teamStandings ?? []} showEmoji />
              )}
            </CardContent>
          </Card>

          {/* Agent Standings */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Agent Standings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StandingsTable
                entries={(standings?.agentStandings ?? []).map((a) => ({
                  ...a,
                  isCurrentUser: a.id === currentUserId,
                }))}
                currentUserId={currentUserId}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
