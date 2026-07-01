'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Award, Flame, TrendingUp, Star, Zap, Shield, Medal, Crown, Target, Swords, Loader2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser } from '@/lib/contracts';

interface AgentProfile {
  id: string;
  totalXp: number;
  level: number;
  title: string | null;
  xpProgress: number;
  xpToNextLevel: number;
  currentTitle: string;
  badges: Array<{
    id: string;
    badge: {
      id: string;
      key: string;
      name: string;
      description: string;
      icon: string;
      category: string;
    };
    earnedAt: string;
    context: any;
  }>;
  streaks: Array<{
    id: string;
    type: string;
    currentCount: number;
    longestCount: number;
    lastDate: string | null;
  }>;
  results: Array<{
    id: string;
    competitionId: string;
    rank: number;
    totalScore: number;
    xpEarned: number;
    wasPresent: boolean;
    createdAt: string;
  }>;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Trophy, Medal, Shield, TrendingUp, Zap, Flame, Award, Crown, Star, Users: Star,
};

const CATEGORY_COLORS: Record<string, string> = {
  competition: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  streak: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  monthly: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

export default function AgentGamificationPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<any[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
          fetch(`/api/gamification/leaderboard/monthly?year=${selectedYear}&month=${selectedMonth}`),
          fetch('/api/gamification/leaderboard?limit=20'),
        ]);

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData.profile);
        }
        if (monthlyRes.ok) {
          const monthlyData = await monthlyRes.json();
          setMonthlyLeaderboard(monthlyData.entries ?? []);
        }
        if (allTimeRes.ok) {
          const allTimeData = await allTimeRes.json();
          setAllTimeLeaderboard(allTimeData.entries ?? []);
        }
      } catch (err) {
        console.error('Error fetching gamification data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [selectedMonth, selectedYear]);

  const BadgeIcon = profile?.badges?.length ? ICON_MAP[profile.badges[0].badge.icon] ?? Award : Award;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Gamification</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gamification</h1>
        <p className="text-muted-foreground mt-1">Your XP, badges, streaks, and rankings</p>
      </div>

      {/* Profile Header Card */}
      <Card className="glass-card overflow-hidden">
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{currentUser?.name || "Agent"}</h2>
              <p className="text-lg text-muted-foreground">
                Level {profile?.level ?? 1} — {profile?.currentTitle ?? "Rookie"}
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{profile?.totalXp?.toLocaleString() ?? 0} XP</span>
                  <span className="text-muted-foreground">
                    {profile?.xpToNextLevel && profile.xpToNextLevel > 0
                      ? `${profile.xpToNextLevel.toLocaleString()} to next level`
                      : "Max level"}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, profile?.xpProgress ?? 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Badges Card */}
        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Badges
            </CardTitle>
            <CardDescription>Earned achievements</CardDescription>
          </CardHeader>
          <CardContent>
            {!profile?.badges?.length ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No badges yet. Complete competitions to earn your first badge!
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {profile.badges.map((ab) => {
                  const Icon = ICON_MAP[ab.badge.icon] ?? Award;
                  const colorClass = CATEGORY_COLORS[ab.badge.category] ?? "bg-gray-500/10 text-gray-500";
                  return (
                    <div
                      key={ab.id}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${colorClass} text-center`}
                    >
                      <Icon className="h-8 w-8" />
                      <span className="text-xs font-medium leading-tight">{ab.badge.name}</span>
                      <span className="text-[10px] opacity-60 leading-tight">{ab.badge.description}</span>
                      <span className="text-[10px] opacity-60">
                        {format(new Date(ab.earnedAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Streaks Card */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Streaks
            </CardTitle>
            <CardDescription>Your winning runs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!profile?.streaks || profile.streaks.length === 0) ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No streaks yet. Win competitions to start a streak!
              </p>
            ) : (
              profile.streaks.map((streak) => (
                <div key={streak.id} className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">{streak.type} Streak</span>
                    <Flame className={`h-4 w-4 ${streak.currentCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{streak.currentCount}</span>
                    <span className="text-xs text-muted-foreground">
                      current
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Best: {streak.longestCount}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboards */}
      <Tabs defaultValue="monthly" className="w-full">
        <TabsList>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
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
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {format(new Date(2000, i), 'MMMM')}
                      </option>
                    ))}
                  </select>
                  <select
                    className="text-sm bg-muted rounded-md px-2 py-1 border"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <option key={i} value={new Date().getFullYear() - i}>
                        {new Date().getFullYear() - i}
                      </option>
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
                  {monthlyLeaderboard.slice(0, 10).map((entry: any, i: number) => {
                    const rankMedal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          entry.userId === currentUser?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                        }`}
                      >
                        <span className="w-8 text-center font-bold text-lg">
                          {rankMedal ?? `#${entry.rank}`}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {generateInitials(entry.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 font-medium text-sm">{entry.name}</span>
                        <span className="text-sm font-semibold">{entry.xp.toLocaleString()} XP</span>
                      </div>
                    );
                  })}
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
              <CardDescription>Top agents by total XP</CardDescription>
            </CardHeader>
            <CardContent>
              {allTimeLeaderboard.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">No rankings yet.</p>
              ) : (
                <div className="space-y-2">
                  {allTimeLeaderboard.map((entry: any) => {
                    const rankMedal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-3 p-3 rounded-lg ${
                          entry.userId === currentUser?.id ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                        }`}
                      >
                        <span className="w-8 text-center font-bold text-lg">
                          {rankMedal ?? `#${entry.rank}`}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs" style={entry.avatarBgColor ? { backgroundColor: entry.avatarBgColor } : {}}>
                            {entry.avatarInitials ?? generateInitials(entry.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Lvl {entry.level} {entry.title} · {entry.badgeCount} badges
                          </p>
                        </div>
                        <span className="text-sm font-semibold">{entry.totalXp.toLocaleString()} XP</span>
                      </div>
                    );
                  })}
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
                    <th className="text-right py-2 font-medium">XP Earned</th>
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
