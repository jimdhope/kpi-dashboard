'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Award, TrendingUp, Medal, Crown, 
  BarChart3, Users, Activity, Loader2, RefreshCw,
  FileText, Download, Calendar, Settings2, Trophy
} from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser } from '@/lib/contracts';
import BadgeManager from '@/components/admin/badge-manager';

interface LeaderboardEntry {
  userId: string;
  name: string;
  totalPoints: number;
  level: number;
  title: string;
  badgeCount: number;
  avatarInitials?: string;
  avatarBgColor?: string;
}

const LEVEL_DEFINITIONS = [
  { level: 1, title: "Rookie", minPoints: 0, maxPoints: 499 },
  { level: 2, title: "Bronze", minPoints: 500, maxPoints: 1499 },
  { level: 3, title: "Silver", minPoints: 1500, maxPoints: 3499 },
  { level: 4, title: "Gold", minPoints: 3500, maxPoints: 6999 },
  { level: 5, title: "Platinum", minPoints: 7000, maxPoints: 11999 },
  { level: 6, title: "Diamond", minPoints: 12000, maxPoints: Infinity },
];

type LeaderboardMode = "alltime" | "monthly" | "yearly";
type BadgeViewMode = "monthly" | "competition";

export default function AdminGamificationPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  // Leaderboard filters
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("monthly");
  const [lbMonth, setLbMonth] = useState(new Date().getMonth() + 1);
  const [lbYear, setLbYear] = useState(new Date().getFullYear());

  // Badge view mode
  const [badgeViewMode, setBadgeViewMode] = useState<BadgeViewMode>("monthly");
  const [badgeMonth, setBadgeMonth] = useState(new Date().getMonth() + 1);
  const [badgeYear, setBadgeYear] = useState(new Date().getFullYear());
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>("");

  // Data
  const [badges, setBadges] = useState<any[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [earnedByMonth, setEarnedByMonth] = useState<any[]>([]);
  const [earnedByCompetition, setEarnedByCompetition] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);

  // Tab tracking — refetch badge data when badges tab activates
  const [activeTab, setActiveTab] = useState("leaderboards");
  const [badgeTabRefresh, setBadgeTabRefresh] = useState(0);

  // Actions
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isCrowning, setIsCrowning] = useState(false);
  const [crownMonth, setCrownMonth] = useState(new Date().getMonth() + 1);
  const [crownYear, setCrownYear] = useState(new Date().getFullYear());

  const refreshPageData = async () => {
    const sessionRes = await fetch('/api/auth/session');
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json();
      if (sessionData.authenticated) setCurrentUser(sessionData.user);
    }

    const [badgeRes, allTimeRes, compRes, statsRes] = await Promise.all([
      fetch('/api/gamification/badges'),
      fetch('/api/gamification/leaderboard?limit=50'),
      fetch('/api/competitions'),
      fetch('/api/gamification/admin/stats'),
    ]);

    if (badgeRes.ok) { const d = await badgeRes.json(); setBadges(d.badges ?? []); }
    if (allTimeRes.ok) { const d = await allTimeRes.json(); setAllTimeLeaderboard(d.entries ?? []); }
    if (compRes.ok) { const d = await compRes.json(); setCompetitions(d.competitions ?? []); }
    if (statsRes.ok) { const d = await statsRes.json(); setStats(d); }
  };

  useEffect(() => {
    async function fetchData() {
      try { await refreshPageData(); }
      catch (err) { console.error('Error fetching gamification admin data:', err); }
      finally { setIsLoading(false); }
    }
    fetchData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchMonthlyLeaderboard = async () => {
      try {
        const res = await fetch(`/api/gamification/leaderboard/monthly?year=${lbYear}&month=${lbMonth}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setMonthlyLeaderboard(d.entries ?? []);
        }
      } catch {}
    };

    const fetchEarnedByMonth = async () => {
      try {
        const res = await fetch(`/api/gamification/admin/badges/earned-by-month?year=${badgeYear}&month=${badgeMonth}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setEarnedByMonth(d.entries ?? []);
        }
      } catch {}
    };

    const fetchEarnedByCompetition = async () => {
      if (!selectedCompetitionId) {
        if (!cancelled) setEarnedByCompetition([]);
        return;
      }

      try {
        const res = await fetch(`/api/gamification/admin/badges/earned-by-competition?competitionId=${selectedCompetitionId}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setEarnedByCompetition(d.entries ?? []);
        }
      } catch {}
    };

    void fetchMonthlyLeaderboard();
    void fetchEarnedByMonth();
    void fetchEarnedByCompetition();

    return () => {
      cancelled = true;
    };
  }, [lbMonth, lbYear, badgeMonth, badgeYear, badgeTabRefresh, selectedCompetitionId]);

  const derivedStats = useMemo(() => {
    const totalPoints = allTimeLeaderboard.reduce((s, e) => s + e.totalPoints, 0);
    const levelCounts: Record<number, number> = {};
    allTimeLeaderboard.forEach(e => { levelCounts[e.level] = (levelCounts[e.level] ?? 0) + 1; });
    const badgeCount = allTimeLeaderboard.reduce((s, e) => s + e.badgeCount, 0);
    return { totalPoints, levelCounts, badgeCount, agentCount: allTimeLeaderboard.length };
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
    } finally { setIsEvaluating(false); }
  };

  const handleCrownChampion = async () => {
    setIsCrowning(true);
    try {
      const res = await fetch('/api/gamification/crown-monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: crownMonth, year: crownYear }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({ title: 'Champion crowned!', description: `${data.champion ?? 'Agent'} is the champion.` });
      } else {
        const err = await res.json();
        toast({ title: 'Failed', description: err.error ?? 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed', description: 'Network error', variant: 'destructive' });
    } finally { setIsCrowning(false); }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  const renderLeaderboardTable = (entries: any[], mode: string) => (
    entries.length === 0 ? (
      <p className="text-muted-foreground text-sm text-center py-4">No data yet.</p>
    ) : (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Badges</TableHead>
                </TableRow>

          </TableHeader>
          <TableBody>
            {entries.map((entry: any, i: number) => (
              <TableRow key={`${entry.userId ?? 'unknown'}-${entry.rank ?? i}-${entry.totalPoints ?? entry.points ?? 0}`}>
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
                <TableCell className="text-right">{entry.level ?? '-'}</TableCell>
                 <TableCell className="text-right font-semibold">{(entry.totalPoints ?? entry.points ?? 0).toLocaleString()}</TableCell>

                <TableCell className="text-right">{entry.badgeCount ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  );

  const renderBadgeCard = (badge: any, agents: any[], badgeMonth_: number, badgeYear_: number, listKey?: string) => (
    <div key={listKey ?? `${badge.id ?? badge.key ?? 'badge'}-${badgeMonth_}-${badgeYear_}`} className="p-3 rounded-lg border bg-muted/30 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
          <Award className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{badge.name}</p>
          <p className="text-[11px] text-muted-foreground/50 line-clamp-2 mt-0.5">{badge.description || ""}</p>
        </div>
      </div>
      {agents.length > 0 ? (
        <div className="border-t pt-2 mt-1">
          <p className="text-xs text-muted-foreground mb-1">
            {agents.length} agent{agents.length === 1 ? "" : "s"} earned this badge:
          </p>
          <div className="flex flex-wrap gap-1">
            {agents.map((a: any, index: number) => (
              <a
                key={`${badge.key ?? badge.id ?? 'badge'}-${a.userId ?? 'unknown'}-${index}`}
                href={`/api/gamification/badges/${badge.key}/image?month=${badgeMonth_}&year=${badgeYear_}&rank=${a.rank}&agentName=${encodeURIComponent(a.name?.split(' ')[0] || 'Agent')}`}
                download={`${badge.name.replace(/\s+/g, '-')}-${format(new Date(badgeYear_, badgeMonth_ - 1), 'MMM-yyyy')}-${a.rank === 1 ? '1st' : a.rank === 2 ? '2nd' : '3rd'}-${a.name?.split(' ')[0] || 'Agent'}.png`}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-primary/5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <Users className="h-3 w-3" />
                {a.name}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No one earned this badge</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gamification</h1>
            <p className="text-muted-foreground mt-1">Manage Points, badges, leaderboards, and champions</p>
          </div>

      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ (stats?.totalPointsAwarded ?? derivedStats.totalPoints).toLocaleString() }</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ stats?.totalProfiles ?? derivedStats.agentCount }</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Badges Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ stats?.totalBadgesAwarded ?? derivedStats.badgeCount }</p>
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

      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        if (v === "badges") setBadgeTabRefresh((n) => n + 1);
      }} className="w-full">
        <TabsList>
          <TabsTrigger value="leaderboards" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Leaderboards
          </TabsTrigger>
          <TabsTrigger value="badges" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Badges
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="manage-badges" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Badge Manager
          </TabsTrigger>
        </TabsList>

        {/* ── Leaderboards Tab ── */}
        <TabsContent value="leaderboards" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2">
                  {leaderboardMode === "alltime" ? <Crown className="h-5 w-5 text-amber-500" /> : <Medal className="h-5 w-5 text-amber-500" />}
                  {leaderboardMode === "alltime" ? "All-Time Leaderboard" : leaderboardMode === "monthly" ? "Monthly Leaderboard" : "Yearly Leaderboard"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={leaderboardMode}
                    onChange={e => setLeaderboardMode(e.target.value as LeaderboardMode)}
                  >
                    <option value="alltime">All-Time</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  {leaderboardMode !== "alltime" && (
                    <>
                      <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={lbMonth} onChange={e => setLbMonth(parseInt(e.target.value))}>
                        {Array.from({ length: 12 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>{format(new Date(2000, i), 'MMMM')}</option>
                        ))}
                      </select>
                      <select className="text-sm bg-muted rounded-md px-2 py-1 border" value={lbYear} onChange={e => setLbYear(parseInt(e.target.value))}>
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
              {leaderboardMode === "alltime"
                ? renderLeaderboardTable(allTimeLeaderboard, "alltime")
                : renderLeaderboardTable(monthlyLeaderboard, "monthly")
              }
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Badges Tab ── */}
        <TabsContent value="badges" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-500" />
                    Badges
                  </CardTitle>
                  <CardDescription>
                    {badgeViewMode === "monthly"
                      ? "Badges earned in a given month — download badge images for celebration"
                      : "Badges earned in a specific competition"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={badgeViewMode}
                    onChange={e => setBadgeViewMode(e.target.value as BadgeViewMode)}
                  >
                    <option value="monthly">By Month</option>
                    <option value="competition">By Competition</option>
                  </select>

                  {badgeViewMode === "monthly" ? (
                    <>
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
                    </>
                  ) : (
                    <select
                      className="text-sm bg-muted rounded-md px-3 py-2 border min-w-[200px]"
                      value={selectedCompetitionId}
                      onChange={e => setSelectedCompetitionId(e.target.value)}
                    >
                      <option value="">Select a competition</option>
                      {competitions
                        .filter((c: any) => !c.isDraft)
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {badges.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No badges defined.</p>
              ) : badgeViewMode === "monthly" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {badges.map((badge) => {
                    const earned = earnedByMonth.find((e: any) => e.badgeKey === badge.key);
                    return renderBadgeCard(badge, earned?.agents ?? [], badgeMonth, badgeYear, `${badge.key ?? badge.id ?? 'badge'}-${badgeMonth}-${badgeYear}`);
                  })}
                </div>
              ) : (
                <div>
                  {!selectedCompetitionId ? (
                    <p className="text-muted-foreground text-sm text-center py-4">Select a competition above to see badges earned.</p>
                  ) : earnedByCompetition.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No badges were earned in this competition.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {earnedByCompetition.map((entry: any) => {
                        const badge = badges.find((b: any) => b.key === entry.badgeKey) ?? { id: entry.badgeKey, key: entry.badgeKey, name: entry.badgeName, description: "" };
                        return renderBadgeCard(badge, entry.agents, new Date().getMonth() + 1, new Date().getFullYear(), `${badge.key ?? badge.id ?? 'badge'}-competition-${entry.badgeKey ?? entry.badgeName ?? 'unknown'}`);
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-4">
          {/* Level Distribution */}
          <Card className="glass-card mb-6">
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
                  const count = derivedStats.levelCounts[def.level] ?? 0;
                  const allCounts = LEVEL_DEFINITIONS.map(d => derivedStats.levelCounts[d.level] ?? 0);
                  const maxCount = Math.max(...allCounts, 1);
                  const pct = (count / maxCount) * 100;
                  const rangeLabel = def.maxPoints === Infinity ? `${def.minPoints.toLocaleString()}+ Points` : `${def.minPoints.toLocaleString()} – ${def.maxPoints.toLocaleString()} Points`;
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

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Administrative actions for competitions and champions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {/* Crown Champion */}
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium">Crown Monthly Champion</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="flex-1 text-sm bg-background rounded-md px-2 py-1 border" value={crownMonth} onChange={e => setCrownMonth(parseInt(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>{format(new Date(2000, i), 'MMMM')}</option>
                      ))}
                    </select>
                    <select className="flex-1 text-sm bg-background rounded-md px-2 py-1 border" value={crownYear} onChange={e => setCrownYear(parseInt(e.target.value))}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={handleCrownChampion} disabled={isCrowning} size="sm" className="w-full">
                    {isCrowning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="h-4 w-4 mr-2" />}
                    Crown Champion
                  </Button>
                </div>

                {/* Evaluate */}
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Evaluate Competitions</span>
                  </div>
                   <p className="text-xs text-muted-foreground">Manually trigger Points and badge evaluation for past competitions</p>

                  <Button onClick={handleEvaluateAll} disabled={isEvaluating} size="sm" variant="secondary" className="w-full">
                    {isEvaluating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Evaluate All
                  </Button>
                </div>

                {/* Certificates */}
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Certificates</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Generate PNG certificates for top performers</p>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <a href="/competitions/certificates">
                      <FileText className="h-4 w-4 mr-2" />
                      Open Certificates
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Badge Manager Tab ── */}
        <TabsContent value="manage-badges" className="mt-4">
          <BadgeManager onBadgeChange={refreshPageData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
