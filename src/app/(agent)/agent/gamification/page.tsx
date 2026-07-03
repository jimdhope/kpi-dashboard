'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Flame, TrendingUp, Medal, Crown, Target, Loader2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser } from '@/lib/contracts';

interface AgentProfile {
  id: string;
  level: number;
  totalPoints: number;
  progress: number;
  pointsToNextLevel: number;
  currentTitle: string;
  badges: Array<{
    id: string;
    badge: { id: string; key: string; name: string; description: string; icon: string; };
    competition: { name: string } | null;
    earnedAt: string;
  }>;
  streaks: Array<{
    id: string; type: string; currentCount: number; longestCount: number;
  }>;
  results: Array<{
    id: string; rank: number; totalScore: number; xpEarned: number; createdAt: string;
  }>;
}

const SCOPE_COLORS: Record<string, string> = {
  COMPETITION: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  MONTHLY: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  YEARLY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  MANUAL: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

export default function AgentGamificationPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<any[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lbMonth, setLbMonth] = useState(new Date().getMonth() + 1);
  const [lbYear, setLbYear] = useState(new Date().getFullYear());

  useEffect(() => {
    async function fetchData() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        if (!sessionRes.ok) return;
        const sessionData = await sessionRes.json();
        if (!sessionData.authenticated) return;
        setCurrentUser(sessionData.user);

        const [profileRes, monthlyRes, allTimeRes] = await Promise.all([
          fetch('/api/gamification/profile'),
          fetch(`/api/gamification/leaderboard/monthly?year=${lbYear}&month=${lbMonth}`),
          fetch('/api/gamification/leaderboard?limit=20'),
        ]);

        if (profileRes.ok) { const d = await profileRes.json(); setProfile(d.profile); }
        if (monthlyRes.ok) { const d = await monthlyRes.json(); setMonthlyLeaderboard(d.entries ?? []); }
        if (allTimeRes.ok) { const d = await allTimeRes.json(); setAllTimeLeaderboard(d.entries ?? []); }
      } catch (err) {
        console.error('Error fetching gamification data:', err);
      } finally { setIsLoading(false); }
    }
    fetchData();
  }, [lbMonth, lbYear]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gamification</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gamification</h1>
        <p className="text-muted-foreground mt-1">Your Points, badges, streaks, and rankings</p>
      </div>

      {/* Profile Hero */}
      <Card className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Award className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold truncate">{currentUser?.name || "Agent"}</h2>
              <p className="text-lg text-muted-foreground">
                Level {profile?.level ?? 1} — {profile?.currentTitle ?? "Rookie"}
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{profile?.totalPoints?.toLocaleString() ?? 0} Points</span>
                  <span className="text-muted-foreground">
                    {profile?.pointsToNextLevel && profile.pointsToNextLevel > 0
                      ? `${profile.pointsToNextLevel.toLocaleString()} to next level`
                      : "Max level"}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, profile?.progress ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Streak badges inline */}
        {profile?.streaks && profile.streaks.length > 0 && (
          <div className="px-6 pb-4 flex gap-3">
            {profile.streaks.map((s) => (
              <div key={s.id} className="flex items-center gap-1.5 text-sm bg-muted/50 rounded-full px-3 py-1">
                <Flame className={`h-4 w-4 ${s.currentCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="font-semibold">{s.currentCount}</span>
                <span className="text-muted-foreground capitalize">{s.type}</span>
                <span className="text-xs text-muted-foreground">(best: {s.longestCount})</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Badges Gallery */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Badges
          </CardTitle>
          <CardDescription>Earned achievements from competitions and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          {!profile?.badges?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No badges yet. Complete competitions to earn your first badge!
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {profile.badges.map((ab) => {
                const scope = ab.badge.key.includes("streak") ? "streak" : ab.badge.key.includes("monthly") ? "MONTHLY" : "COMPETITION";
                const colorClass = SCOPE_COLORS[scope] ?? SCOPE_COLORS["COMPETITION"];
                return (
                  <div key={ab.id} className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${colorClass} text-center`}>
                    <span className="text-3xl">{ab.badge.icon || "🏅"}</span>
                    <span className="text-xs font-medium leading-tight">{ab.badge.name}</span>
                    {ab.badge.description && (
                      <span className="text-[10px] opacity-60 leading-tight line-clamp-2">{ab.badge.description}</span>
                    )}
                    {ab.competition?.name && (
                      <span className="text-[10px] font-medium opacity-70">{ab.competition.name}</span>
                    )}
                    <span className="text-[10px] opacity-60 mt-auto pt-1">
                      {format(new Date(ab.earnedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboards */}
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Medal className="h-4 w-4" />
            Monthly
          </TabsTrigger>
          <TabsTrigger value="alltime" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            All-Time
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monthly" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-amber-500" />
                  Monthly Leaderboard
                </CardTitle>
                <div className="flex items-center gap-2">
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
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {monthlyLeaderboard.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No data for this month.</p>
              ) : (
                <div className="space-y-2">
                  {monthlyLeaderboard.slice(0, 10).map((entry: any, i: number) => (
                    <div key={entry.userId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        entry.userId === currentUser?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <span className="w-8 text-center font-bold text-lg">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{generateInitials(entry.name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 font-medium text-sm">{entry.name}</span>
                      <span className="text-sm font-semibold">{entry.points.toLocaleString()} Points</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alltime" className="mt-4">
          <Card className="glass-card">
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Crown className="h-5 w-5 text-amber-500" />
                 All-Time Leaderboard
               </CardTitle>
               <CardDescription>Top agents by total Points</CardDescription>
             </CardHeader>

            <CardContent>
              {allTimeLeaderboard.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No rankings yet.</p>
              ) : (
                <div className="space-y-2">
                  {allTimeLeaderboard.map((entry: any) => (
                    <div key={entry.userId}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        entry.userId === currentUser?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <span className="w-8 text-center font-bold text-lg">
                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                      </span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{generateInitials(entry.name)}</AvatarFallback>
                      </Avatar>
                       <div className="flex-1">
                         <p className="font-medium text-sm">{entry.name}</p>
                         <p className="text-xs text-muted-foreground">
                           Lvl {entry.level} {entry.title} · {entry.badgeCount} badges
                         </p>
                       </div>
                       <span className="text-sm font-semibold">{entry.totalPoints.toLocaleString()} Points</span>
                     </div>

                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Competition History */}
      {profile?.results && profile.results.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Competition History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-center py-2 font-medium">Rank</th>
                    <th className="text-right py-2 font-medium">Score</th>
                    <th className="text-right py-2 font-medium">Points Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.results.slice(0, 20).map((r) => (
                    <tr key={r.id} className="border-b border-muted/50">
                      <td className="py-2">{format(new Date(r.createdAt), 'MMM d, yyyy')}</td>
                      <td className="py-2 text-center">
                        <span className={`font-bold ${
                          r.rank === 1 ? 'text-amber-500' : r.rank === 2 ? 'text-gray-400' : r.rank === 3 ? 'text-amber-700' : ''
                        }`}>
                          #{r.rank}
                        </span>
                      </td>
                      <td className="py-2 text-right">{r.totalScore.toLocaleString()}</td>
                      <td className="py-2 text-right font-semibold text-green-500">+{r.xpEarned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
