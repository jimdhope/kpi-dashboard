'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Award, TrendingUp, Star, Medal, Crown, 
  BarChart3, Users, Activity, Loader2, RefreshCw,
  FileText, Download, Calendar, Settings2
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser } from '@/lib/contracts';
import BadgeManager from '@/components/admin/badge-manager';

interface BadgeDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  totalXp: number;
  level: number;
  title: string;
  badgeCount: number;
  avatarInitials?: string;
  avatarBgColor?: string;
}

const LEVEL_DEFINITIONS = [
  { level: 1, title: "Rookie", minXp: 0, maxXp: 499 },
  { level: 2, title: "Bronze", minXp: 500, maxXp: 1499 },
  { level: 3, title: "Silver", minXp: 1500, maxXp: 3499 },
  { level: 4, title: "Gold", minXp: 3500, maxXp: 6999 },
  { level: 5, title: "Platinum", minXp: 7000, maxXp: 11999 },
  { level: 6, title: "Diamond", minXp: 12000, maxXp: Infinity },
];

type LeaderboardMode = "alltime" | "monthly";

export default function AdminGamificationPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [badgeMonth, setBadgeMonth] = useState(new Date().getMonth() + 1);
  const [badgeYear, setBadgeYear] = useState(new Date().getFullYear());

  // Data
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentChampion, setCurrentChampion] = useState<any>(null);
  const [earnedByMonth, setEarnedByMonth] = useState<any[]>([]);

  // Actions
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCrowning, setIsCrowning] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [pods, setPods] = useState<any[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [agentProfile, setAgentProfile] = useState<any>(null);
  const [isLoadingAgent, setIsLoadingAgent] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const refreshPageData = async () => {
    const sessionRes = await fetch('/api/auth/session');
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      if (sessionData.authenticated) setCurrentUser(sessionData.user);
    }

    const [badgeRes, allTimeRes, monthlyRes, compRes, championRes, podRes] = await Promise.all([
      fetch('/api/gamification/badges'),
      fetch('/api/gamification/leaderboard?limit=50'),
      fetch(`/api/gamification/leaderboard/monthly?year=${selectedYear}&month=${selectedMonth}`),
      fetch('/api/competitions'),
      fetch('/api/gamification/crown/current'),
      fetch('/api/pods'),
    ]);

    if (badgeRes.ok) { const d = await badgeRes.json(); setBadges(d.badges ?? []); }
    if (allTimeRes.ok) { const d = await allTimeRes.json(); setAllTimeLeaderboard(d.entries ?? []); }
    if (monthlyRes.ok) { const d = await monthlyRes.json(); setMonthlyLeaderboard(d.entries ?? []); }
    if (compRes.ok) { const d = await compRes.json(); setCompetitions(d.competitions ?? []); }
    if (championRes.ok) { const d = await championRes.json(); setCurrentChampion(d.champion ?? null); }
    if (podRes.ok) { const d = await podRes.json(); setPods(d.pods ?? []); }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        await refreshPageData();
      } catch (err) {
        console.error('Error fetching gamification admin data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedMonth, selectedYear]);

  const stats = useMemo(() => {
    const totalXp = allTimeLeaderboard.reduce((s, e) => s + e.totalXp, 0);
    const levelCounts: Record<number, number> = {};
    allTimeLeaderboard.forEach(e => {
      levelCounts[e.level] = (levelCounts[e.level] ?? 0) + 1;
    });
    const badgeCount = allTimeLeaderboard.reduce((s, e) => s + e.badgeCount, 0);
    return { totalXp, levelCounts, badgeCount, agentCount: allTimeLeaderboard.length };
  }, [allTimeLeaderboard]);

  const levelLookup = useMemo(() => {
    const map = new Map<string, { level: number; badgeCount: number }>();
    allTimeLeaderboard.forEach(e => map.set(e.userId, { level: e.level, badgeCount: e.badgeCount }));
    return map;
  }, [allTimeLeaderboard]);

  const filteredMembers = useMemo(() => {
    if (!selectedPodId) return [];
    const pod = pods.find((p: any) => p.id === selectedPodId);
    return pod?.members ?? [];
  }, [selectedPodId, pods]);

  const selectedAgentName = useMemo(() => {
    if (!selectedAgentId) return "";
    const member = filteredMembers.find((m: any) => m.id === selectedAgentId);
    return member?.name ?? "";
  }, [selectedAgentId, filteredMembers]);

  useEffect(() => {
    if (!selectedAgentId) {
      setAgentProfile(null);
      setAgentError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingAgent(true);
      setAgentError(null);
      try {
        const res = await fetch(`/api/gamification/admin/agents/${selectedAgentId}/profile`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to fetch agent profile");
        }
        const data = await res.json();
        if (!cancelled) setAgentProfile(data.profile);
      } catch (err: any) {
        if (!cancelled) setAgentError(err.message);
      } finally {
        if (!cancelled) setIsLoadingAgent(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/gamification/admin/badges/earned-by-month?year=${badgeYear}&month=${badgeMonth}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setEarnedByMonth(data.entries ?? []);
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [badgeMonth, badgeYear]);

  const handleEvaluateAll = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch('/api/gamification/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allPending: true }) });
      if (res.ok) {
        const data = await res.json();
        const summaries = data.summaries ?? [];
        const totalAgents = summaries.reduce((s: number, sm: any) => s + (sm.agentsProcessed ?? 0), 0);
        toast({ title: 'Evaluation complete', description: `${summaries.length} competition${summaries.length === 1 ? '' : 's'} evaluated, ${totalAgents} agent${totalAgents === 1 ? '' : 's'} processed.` });
        await refreshPageData();
      } else {
        const err = await res.json();
        toast({ title: 'Evaluation failed', description: err.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Evaluation failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAssignEntries = async () => {
    setIsAssigning(true);
    try {
      const res = await fetch('/api/gamification/assign-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const total = (data.results ?? []).reduce((s: number, r: any) => s + (r.entriesCreated ?? 0), 0);
        toast({ title: 'Entries assigned', description: `${total} agent${total === 1 ? '' : 's'} assigned to ${data.results?.length ?? 0} competition${data.results?.length === 1 ? '' : 's'}.` });
        await refreshPageData();
      } else {
        const err = await res.json();
        toast({ title: 'Failed', description: err.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleCrownChampion = async () => {
    if (!selectedMonth || !selectedYear) {
      toast({ title: 'Select month/year', variant: 'destructive' });
      return;
    }
    setIsCrowning(true);
    try {
      const res = await fetch('/api/gamification/crown-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: `Champion crowned!`, description: `${data.champion ?? 'Agent'} is the champion.` });
        await refreshPageData();
      } else {
        const err = await res.json();
        toast({ title: 'Failed', description: err.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed', description: 'Network error', variant: 'destructive' });
    } finally {
      setIsCrowning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  const displayEntries = leaderboardMode === "alltime" ? allTimeLeaderboard : monthlyLeaderboard;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gamification Admin</h1>
          <p className="text-muted-foreground mt-1">Manage XP, badges, leaderboards, and champions</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleEvaluateAll} disabled={isEvaluating}>
          {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Evaluate All
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total XP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalXp.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.agentCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Badges Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.badgeCount}</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Badge Types</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{badges.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="leaderboards" className="w-full">
        <TabsList>
          <TabsTrigger value="leaderboards" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Leaderboards
          </TabsTrigger>
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Badge Catalog
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Admin Actions
          </TabsTrigger>
          <TabsTrigger value="levels" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Level Distribution
          </TabsTrigger>
           <TabsTrigger value="agent-badges" className="flex items-center gap-2">
             <Medal className="h-4 w-4" />
             Agent Badges
           </TabsTrigger>
           <TabsTrigger value="manage-badges" className="flex items-center gap-2">
             <Settings2 className="h-4 w-4" />
             Badge Manager
           </TabsTrigger>
         </TabsList>

        {/* Leaderboards Tab — Merged */}
        <TabsContent value="leaderboards" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  {leaderboardMode === "alltime" ? <Crown className="h-5 w-5 text-amber-500" /> : <Medal className="h-5 w-5 text-amber-500" />}
                  {leaderboardMode === "alltime" ? "All-Time Leaderboard" : "Monthly Leaderboard"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={leaderboardMode}
                    onChange={e => setLeaderboardMode(e.target.value as LeaderboardMode)}
                  >
                    <option value="alltime">All-Time</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  {leaderboardMode === "monthly" && (
                    <>
                      <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{format(new Date(2000, i), 'MMMM')}</option>
                        ))}
                      </select>
                      <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {displayEntries.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">
                  {leaderboardMode === "monthly" ? "No data for this period." : "No data yet."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Level</TableHead>
                        <TableHead className="text-right">XP</TableHead>
                        <TableHead className="text-right">Badges</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayEntries.map((entry: any, i) => {
                        const lookup = leaderboardMode === "monthly" ? levelLookup.get(entry.userId) : null;
                        const level = leaderboardMode === "alltime" ? entry.level : (lookup?.level ?? 1);
                        const badgeCount = leaderboardMode === "alltime" ? entry.badgeCount : (lookup?.badgeCount ?? 0);
                        const xp = leaderboardMode === "alltime" ? entry.totalXp : entry.xp;
                        return (
                          <TableRow key={entry.userId}>
                            <TableCell className="font-bold text-lg">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank ?? i + 1}`}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs">{generateInitials(entry.name)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{entry.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{level}</TableCell>
                            <TableCell className="text-right font-semibold">{xp.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{leaderboardMode === "monthly" && !lookup ? "–" : badgeCount}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badge Catalog Tab — Month Selector + Gallery */}
        <TabsContent value="badges" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  Badge Catalog
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={badgeMonth} onChange={e => setBadgeMonth(parseInt(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{format(new Date(2000, i), 'MMMM')}</option>
                    ))}
                  </select>
                  <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={badgeYear} onChange={e => setBadgeYear(parseInt(e.target.value))}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <CardDescription>
                Download badge images with {format(new Date(badgeYear, badgeMonth - 1), 'MMMM yyyy')} context for celebration materials
              </CardDescription>
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No badges defined.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {badges.map((badge) => {
                    const earned = earnedByMonth.find((e: any) => e.badgeKey === badge.key);
                    const agents = earned?.agents ?? [];
                    return (
                      <div key={badge.id} className="p-3 rounded-lg border bg-muted/30 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Award className="h-4 w-4 text-amber-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{badge.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{badge.category}</p>
                            <p className="text-[11px] text-muted-foreground/50 line-clamp-2 mt-0.5">{badge.description || ""}</p>
                          </div>

                        </div>
                        {agents.length > 0 && (
                          <div className="border-t pt-2 mt-1">
                            <p className="text-xs text-muted-foreground mb-1">
                              {agents.length} agent{agents.length === 1 ? "" : "s"} earned this badge:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {agents.map((a: any) => (
                                <a
                                  key={a.agentProfileId}
                                  href={`/api/gamification/badges/${badge.key}/image?month=${badgeMonth}&year=${badgeYear}&rank=${a.rank}&agentName=${encodeURIComponent(a.name?.split(' ')[0] || 'Agent')}`}
                                  download={`${badge.name.replace(/\s+/g, '-')}-${format(new Date(badgeYear, badgeMonth - 1), 'MMM-yyyy')}-${a.rank === 1 ? '1st' : a.rank === 2 ? '2nd' : '3rd'}-${a.name?.split(' ')[0] || 'Agent'}.png`}
                                  className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                                >
                                  <Users className="h-3 w-3" />
                                  {a.name}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {agents.length === 0 && (
                          <p className="text-xs text-muted-foreground italic">No one earned this badge this month</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Actions Tab */}
        <TabsContent value="actions" className="mt-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Crown Champion */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Crown Monthly Champion
                </CardTitle>
                <CardDescription>
                  Select a month/year and crown the top agent as champion
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <select className="flex-1 text-sm bg-muted rounded-md px-3 py-2 border" value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{format(new Date(2000, i), 'MMMM')}</option>
                    ))}
                  </select>
                  <select className="flex-1 text-sm bg-muted rounded-md px-3 py-2 border" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleCrownChampion} disabled={isCrowning} className="w-full">
                  {isCrowning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                  Crown Champion
                </Button>
                {currentChampion && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-muted-foreground">Current champion:</p>
                    <p className="font-medium text-sm mt-1">
                      {currentChampion.name} — {format(new Date(currentChampion.monthDate), 'MMMM yyyy')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evaluate Competitions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Evaluate Competitions
                </CardTitle>
                <CardDescription>
                  Manually trigger XP and badge evaluation for past competitions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleAssignEntries} disabled={isAssigning} variant="outline" className="w-full">
                  {isAssigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                  Assign Agents to Competitions
                </Button>
                <Button onClick={handleEvaluateAll} disabled={isEvaluating} variant="secondary" className="w-full">
                  {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Evaluate All Past Competitions
                </Button>
              </CardContent>
            </Card>

            {/* Certificates Link */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Certificates
                </CardTitle>
                <CardDescription>
                  Generate certificate images for competition winners
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <a href="/competitions/certificates">
                    <FileText className="h-4 w-4 mr-2" />
                    Open Certificates
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Level Distribution Tab — Enriched */}
        <TabsContent value="levels" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Level Distribution
              </CardTitle>
              <CardDescription>Agent count by level with title and XP range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {LEVEL_DEFINITIONS.map((def) => {
                  const count = stats.levelCounts[def.level] ?? 0;
                  const allCounts = LEVEL_DEFINITIONS.map(d => stats.levelCounts[d.level] ?? 0);
                  const maxCount = Math.max(...allCounts, 1);
                  const pct = (count / maxCount) * 100;
                  const rangeLabel = def.maxXp === Infinity ? `${def.minXp.toLocaleString()}+ XP` : `${def.minXp.toLocaleString()} – ${def.maxXp.toLocaleString()} XP`;
                  return (
                    <div key={def.level} className="flex items-center gap-3">
                      <span className="w-44 text-sm font-medium text-right shrink-0">Level {def.level} — {def.title}</span>
                      <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden" title={rangeLabel}>
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-primary/60 to-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-sm font-semibold text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent Badges Tab */}
        <TabsContent value="agent-badges" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-amber-500" />
                  Agent Badges
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={selectedPodId}
                    onChange={e => { setSelectedPodId(e.target.value); setSelectedAgentId(""); setAgentProfile(null); setAgentError(null); }}
                  >
                    <option value="">Select Pod</option>
                    {pods.map((pod: any) => (
                      <option key={pod.id} value={pod.id}>{pod.name}</option>
                    ))}
                  </select>
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={selectedAgentId}
                    onChange={e => setSelectedAgentId(e.target.value)}
                    disabled={!selectedPodId}
                  >
                    <option value="">Select Agent</option>
                    {filteredMembers.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <CardDescription>
                {selectedAgentId
                  ? `Viewing badges for ${selectedAgentName}`
                  : "Select a pod and agent to see their earned badges"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedAgentId && (
                <p className="text-muted-foreground text-sm text-center py-4">
                  Select a pod and agent above.
                </p>
              )}
              {isLoadingAgent && selectedAgentId && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {agentError && (
                <p className="text-sm text-destructive text-center py-4">{agentError}</p>
              )}
              {agentProfile && !isLoadingAgent && (
                <>
                  {/* Agent Info */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 border mb-6">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="text-sm">{generateInitials(selectedAgentName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">{selectedAgentName}</p>
                      <p className="text-sm text-muted-foreground">
                        Level {agentProfile.currentTitle} &middot; {agentProfile.totalXp.toLocaleString()} XP &middot; {agentProfile.badges.length} badge{agentProfile.badges.length === 1 ? "" : "s"}
                      </p>
                      {agentProfile.xpToNextLevel > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {agentProfile.xpToNextLevel.toLocaleString()} XP to next level
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Earned Badges Grid */}
                  {agentProfile.badges.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">
                      This agent has not earned any badges yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {agentProfile.badges.map((ab: any) => {
                        const badge = ab.badge;
                        const earnedDate = ab.earnedAt ? format(new Date(ab.earnedAt), 'MMM d, yyyy') : '';
                        return (
                          <div key={ab.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <Award className="h-5 w-5 text-amber-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{badge.name}</p>
                              {badge.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{badge.description}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {badge.category ?? badge.key}
                                {earnedDate && <span> &middot; {earnedDate}</span>}
                              </p>
                            </div>
                            <a
                              href={`/api/gamification/badges/${badge.key}/image?agentName=${encodeURIComponent(selectedAgentName)}`}
                              download={`${badge.name.replace(/\s+/g, '-')}-${selectedAgentName.replace(/\s+/g, '-')}.png`}
                              className="shrink-0 h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
                              title="Download badge image"
                            >
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
               )}
             </CardContent>
           </Card>
         </TabsContent>
         <TabsContent value="manage-badges" className="mt-4">
           <BadgeManager onBadgeChange={refreshPageData} />
         </TabsContent>
       </Tabs>
     </div>
   );
 }
