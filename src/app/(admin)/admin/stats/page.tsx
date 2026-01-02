
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Leaderboard } from '@/components/leaderboard';
import { DateRangePicker } from '@/components/date-range-picker';
import { Filter, GanttChartSquare, Star, Users, BarChart, AlertCircle, Sigma, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/models/types';


interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
}

interface RuleBreakdownEntry {
    name: string;
    totalValue: number;
    emoji?: string;
}


export default function StatsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [logs, setLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [filterType, setFilterType] = useState<'period' | 'competition'>('period');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 29), to: new Date() });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribes = [
      onSnapshot(query(collection(db, 'pods'), orderBy('name')), snap => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))),
      onSnapshot(query(collection(db, 'competitions'), orderBy('startDate', 'desc')), snap => {
          const fetchedComps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Competition));
          setCompetitions(fetchedComps);
          const rules = fetchedComps.flatMap(c => c.rules || []);
          const uniqueRulesMap = new Map<string, RuleFormData>();
          rules.forEach(rule => { if (rule.id) uniqueRulesMap.set(rule.id, rule); });
          setAllRules(Array.from(uniqueRulesMap.values()));
      }),
      onSnapshot(query(collection(db, 'users')), snap => setUsers(snap.docs.map(d => ({id: d.id, ...d.data()} as AppUser)))),
      onSnapshot(query(collection(db, 'dailyAchievements')), snap => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
        setIsLoading(false);
      }, err => {
        console.error("Error fetching logs:", err);
        setError("Failed to load performance data.");
        setIsLoading(false);
      })
    ];
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  const handleFilterTypeChange = (type: 'period' | 'competition') => {
    setFilterType(type);
    setSelectedPeriod('30');
    setSelectedCompetitionId('');
    setDateRange({ from: subDays(new Date(), 29), to: new Date() });
  };
  
  const handlePeriodChange = (value: string) => {
    setSelectedPeriod(value);
    if (value !== 'custom') {
      setDateRange({ from: subDays(new Date(), parseInt(value) - 1), to: new Date() });
    }
  };

  const { filteredLogs } = useMemo(() => {
    let start: Date | undefined, end: Date | undefined;
    if (filterType === 'competition' && selectedCompetitionId) {
        const comp = competitions.find(c => c.id === selectedCompetitionId);
        start = comp?.startDate.toDate();
        end = comp?.endDate.toDate();
    } else {
        start = dateRange?.from;
        end = dateRange?.to;
    }

    if (!start || !end) return { filteredLogs: [] };

    const startDate = startOfDay(start);
    const endDate = endOfDay(end);

    return { 
        filteredLogs: logs.filter(log => {
            const logDate = log.date.toDate();
            const podMatch = selectedPodId === 'all' || log.podId === selectedPodId;
            return logDate >= startDate && logDate <= endDate && podMatch;
        })
    };
  }, [filterType, selectedCompetitionId, dateRange, selectedPodId, logs, competitions]);
  
  const { totalPoints, totalAchievements, agentLeaderboard, podLeaderboard, ruleBreakdown } = useMemo(() => {
    const totalPoints = filteredLogs.reduce((sum, log) => sum + (log.points || 0), 0);
    const totalAchievements = filteredLogs.reduce((sum, log) => sum + (log.value || 0), 0);
    
    const agentScores: Record<string, number> = {};
    const podScores: Record<string, number> = {};
    const ruleTotals: Record<string, { totalValue: number; emoji?: string }> = {};

    const ruleIdToNameMap = new Map(allRules.map(rule => [rule.id, rule.name]));
    const ruleNameToEmojiMap = new Map(allRules.map(rule => [rule.name, rule.emoji || '❓']));

    filteredLogs.forEach(log => {
        agentScores[log.agentId] = (agentScores[log.agentId] || 0) + (log.points || 0);
        podScores[log.podId] = (podScores[log.podId] || 0) + (log.points || 0);

        const ruleName = ruleIdToNameMap.get(log.ruleId);
        if (ruleName) {
            if (!ruleTotals[ruleName]) {
                ruleTotals[ruleName] = { totalValue: 0, emoji: ruleNameToEmojiMap.get(ruleName) };
            }
            ruleTotals[ruleName].totalValue += log.value;
        }
    });

    const finalAgentLeaderboard = Object.entries(agentScores).map(([id, score]) => ({ id, score, name: users.find(u=>u.id===id)?.name || 'Unknown' }));
    const finalPodLeaderboard = Object.entries(podScores).map(([id, score]) => ({ id, name: pods.find(p=>p.id === id)?.name || 'Unknown', score }));
    
    const finalRuleBreakdown: RuleBreakdownEntry[] = Object.entries(ruleTotals)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a,b) => b.totalValue - a.totalValue);

    return { totalPoints, totalAchievements, agentLeaderboard: finalAgentLeaderboard, podLeaderboard: finalPodLeaderboard, ruleBreakdown: finalRuleBreakdown };
  }, [filteredLogs, pods, allRules, users]);


  const summaryCards = [
    { title: "Total Points Awarded", value: totalPoints.toLocaleString(), icon: <Star className="text-muted-foreground" /> },
    { title: "Total Achievements Logged", value: totalAchievements.toLocaleString(), icon: <TrendingUp className="text-muted-foreground" /> },
    { title: "Active Agents", value: agentLeaderboard.length.toLocaleString(), icon: <Users className="text-muted-foreground" /> },
    { title: "Active Pods", value: podLeaderboard.length.toLocaleString(), icon: <Sigma className="text-muted-foreground" /> },
  ];

  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-6 md:grid-cols-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
            <Skeleton className="h-96 w-full" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GanttChartSquare className="h-5 w-5" /> Performance Stats</CardTitle>
          <CardDescription>Analyze performance across different timeframes, competitions, and pods.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="grid gap-2">
                <Label>Filter By</Label>
                <Select value={filterType} onValueChange={(v) => handleFilterTypeChange(v as any)}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value="period">Time Period</SelectItem><SelectItem value="competition">Competition</SelectItem></SelectContent>
                </Select>
            </div>

            {filterType === 'period' && (
                <>
                    <div className="grid gap-2">
                        <Label>Period</Label>
                        <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">Last 7 Days</SelectItem>
                                <SelectItem value="30">Last 30 Days</SelectItem>
                                <SelectItem value="90">Last 90 Days</SelectItem>
                                <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                        <Label>Date Range</Label>
                        <DateRangePicker date={dateRange} setDate={setDateRange} disabled={selectedPeriod !== 'custom'} />
                    </div>
                </>
            )}

            {filterType === 'competition' && (
                <div className="grid gap-2">
                    <Label>Competition</Label>
                    <Select value={selectedCompetitionId} onValueChange={setSelectedCompetitionId}>
                        <SelectTrigger><SelectValue placeholder="Select Competition"/></SelectTrigger>
                        <SelectContent>{competitions.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            )}
            
            <div className="grid gap-2">
              <Label>Pod</Label>
              <Select value={selectedPodId} onValueChange={setSelectedPodId}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Pods</SelectItem>
                    {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><CardDescription>{error}</CardDescription></Alert>}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
            <Card key={index} className="frosted-glass">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                    {card.icon}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">{card.value}</div>
                </CardContent>
            </Card>
        ))}
      </div>

       <Card className="frosted-glass">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5" /> Achievement Breakdown</CardTitle>
                <CardDescription>Total counts for each achievement in the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
                {ruleBreakdown.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {ruleBreakdown.map(rule => (
                           <Card key={rule.name} className="shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium truncate" title={rule.name}>{rule.name}</CardTitle>
                                    <span className="text-lg">{rule.emoji}</span>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-primary">{rule.totalValue.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">Total Count</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-4">No achievement data to display for the selected filters.</p>
                )}
            </CardContent>
        </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Leaderboard title="Agent Leaderboard" entries={agentLeaderboard} isStickyHeader={true} />
        <Leaderboard title="Pod Leaderboard" entries={podLeaderboard} isStickyHeader={true}/>
      </div>

    </div>
  );
}
