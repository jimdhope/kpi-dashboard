'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Trophy, Award, Flame, TrendingUp, Star, Zap, Shield, Medal, Crown, 
  Target, Swords, BarChart3, Users, Activity, Loader2, RefreshCw,
  CheckCircle2, XCircle, UserCheck, FileText, Download, Users
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser } from '@/lib/contracts';

interface BadgeDefinition {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earnedCount?: number;
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

interface AgentProfile {
  id: string;
  totalXp: number;
  level: number;
  title: string | null;
  currentTitle: string;
  xpProgress: number;
}

export default function AdminGamificationPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Data
  const [badges, setBadges] = useState<BadgeDefinition[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [currentChampion, setCurrentChampion] = useState<any>(null);

  // Actions
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCrowning, setIsCrowning] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>('');

  const refreshPageData = async () => {
    const sessionRes = await fetch('/api/auth/session');
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      if (sessionData.authenticated) setCurrentUser(sessionData.user);
    }

    const [
      badgeRes, allTimeRes, monthlyRes, 
      compRes, championRes
    ] = await Promise.all([
      fetch('/api/gamification/badges'),
      fetch('/api/gamification/leaderboard?limit=50'),
      fetch(`/api/gamification/leaderboard/monthly?year=${selectedYear}&month=${selectedMonth}`),
      fetch('/api/competitions'),
      fetch('/api/gamification/crown/current'),
    ]);

    if (badgeRes.ok) { const d = await badgeRes.json(); setBadges(d.badges ?? []); }
    if (allTimeRes.ok) { const d = await allTimeRes.json(); setAllTimeLeaderboard(d.entries ?? []); }
    if (monthlyRes.ok) { const d = await monthlyRes.json(); setMonthlyLeaderboard(d.entries ?? []); }
    if (compRes.ok) { const d = await compRes.json(); setCompetitions(d.competitions ?? []); }
    if (championRes.ok) { const d = await championRes.json(); setCurrentChampion(d.champion ?? null); }
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
        </TabsList>

        {/* Leaderboards Tab */}
        <TabsContent value="leaderboards" className="mt-4 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  All-Time Leaderboard
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {allTimeLeaderboard.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No data yet.</p>
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
                      {allTimeLeaderboard.map((entry: any, i) => (
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
                          <TableCell className="text-right">{entry.level}</TableCell>
                          <TableCell className="text-right font-semibold">{entry.totalXp.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{entry.badgeCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-amber-500" />
                  Monthly Leaderboard
                </CardTitle>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyLeaderboard.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No data for this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Level</TableHead>
                        <TableHead className="text-right">XP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyLeaderboard.slice(0, 20).map((entry: any, i) => (
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
                          <TableCell className="text-right">{entry.level}</TableCell>
                          <TableCell className="text-right font-semibold">{entry.xp.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Badge Catalog Tab */}
        <TabsContent value="badges" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Badge Catalog
              </CardTitle>
              <CardDescription>All available badges and how many agents have earned each</CardDescription>
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No badges defined.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {badges.map((badge) => (
                    <div key={badge.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Award className="h-5 w-5 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{badge.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{badge.category}</p>
                        <p className="text-xs text-amber-500 font-medium mt-0.5">
                          {badge.earnedCount ?? 0} earned
                        </p>
                      </div>
                      <a
                        href={`/api/gamification/badges/${badge.key}/image`}
                        download
                        className="shrink-0 h-8 w-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
                        title="Download badge image"
                      >
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </div>
                  ))}
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

        {/* Level Distribution Tab */}
        <TabsContent value="levels" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Level Distribution
              </CardTitle>
              <CardDescription>How agents are distributed across levels</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.levelCounts).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(stats.levelCounts)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([level, count]) => {
                      const maxCount = Math.max(...Object.values(stats.levelCounts));
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={level} className="flex items-center gap-3">
                          <span className="w-16 text-sm font-medium text-right">Level {level}</span>
                          <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-primary/60 to-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-10 text-sm font-semibold text-right">{count}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
