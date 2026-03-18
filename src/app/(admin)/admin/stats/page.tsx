
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
import { subDays, startOfDay, endOfDay, format, startOfYear, endOfYear, getYear, subYears } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/date-range-picker';
import { Filter, GanttChartSquare, Star, Users, BarChart, AlertCircle, Sigma, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import type { RuleFormData } from '@/models/types';


interface RuleBreakdownEntry {
    name: string;
    totalValue: number;
    emoji?: string;
}

// Updated interface for Top Trumps cards
interface TopTrumpEntry {
  id: string;
  name: string;
  score: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  ruleBreakdown: RuleBreakdownEntry[];
}


export default function StatsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [logs, setLogs] = useState<DailyAchievementLog[]>([]);
  const [allRules, setAllRules] = useState<RuleFormData[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [filterType, setFilterType] = useState<'period' | 'competition' | 'year'>('period');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 29), to: new Date() });
  const [selectedYear, setSelectedYear] = useState<string>(String(getYear(new Date())));

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

  const handleFilterTypeChange = (type: 'period' | 'competition' | 'year') => {
    setFilterType(type);
    setSelectedPeriod('30');
    setSelectedCompetitionId('');
    setDateRange({ from: subDays(new Date(), 29), to: new Date() });
    setSelectedYear(String(getYear(new Date())));
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
    } else if (filterType === 'year') {
        const yearNum = parseInt(selectedYear, 10);
        if (!isNaN(yearNum)) {
            start = startOfYear(new Date(yearNum, 0, 1));
            end = endOfYear(new Date(yearNum, 11, 31));
        }
    } else { // period
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
  }, [filterType, selectedCompetitionId, dateRange, selectedPodId, selectedYear, logs, competitions]);
  
  const { totalPoints, totalAchievements, agentCards, podCards, ruleBreakdown } = useMemo(() => {
    const totalPoints = filteredLogs.reduce((sum, log) => sum + (log.points || 0), 0);
    const totalAchievements = filteredLogs.reduce((sum, log) => sum + (log.value || 0), 0);
    
    const ruleIdToDetailsMap = new Map(allRules.map(rule => [rule.id, { name: rule.name, emoji: rule.emoji || '❓' }]));
    
    // --- Overall Rule Breakdown ---
    const overallRuleTotals: Record<string, { totalValue: number; originalName: string; emoji?: string; }> = {};
    filteredLogs.forEach(log => {
        const ruleDetails = ruleIdToDetailsMap.get(log.ruleId);
        if (ruleDetails) {
            const normalizedName = ruleDetails.name.trim().toLowerCase();
            if (!overallRuleTotals[normalizedName]) {
                overallRuleTotals[normalizedName] = { totalValue: 0, originalName: ruleDetails.name, emoji: ruleDetails.emoji };
            }
            overallRuleTotals[normalizedName].totalValue += log.value;
        }
    });

    const finalRuleBreakdown: RuleBreakdownEntry[] = Object.values(overallRuleTotals)
        .map(data => ({ name: data.originalName, totalValue: data.totalValue, emoji: data.emoji }))
        .sort((a,b) => b.totalValue - a.totalValue);

    // --- Data Aggregation for Cards ---
    const agentData: Record<string, { score: number; ruleTotals: Record<string, number> }> = {};
    const podData: Record<string, { score: number; ruleTotals: Record<string, number> }> = {};

    filteredLogs.forEach(log => {
        // Agent data aggregation
        if (!agentData[log.agentId]) agentData[log.agentId] = { score: 0, ruleTotals: {} };
        agentData[log.agentId].score += (log.points || 0);
        agentData[log.agentId].ruleTotals[log.ruleId] = (agentData[log.agentId].ruleTotals[log.ruleId] || 0) + log.value;

        // Pod data aggregation
        const podId = log.podId || 'unknown';
        if (!podData[podId]) podData[podId] = { score: 0, ruleTotals: {} };
        podData[podId].score += (log.points || 0);
        podData[podId].ruleTotals[log.ruleId] = (podData[podId].ruleTotals[log.ruleId] || 0) + log.value;
    });

    // Helper to process rule breakdowns
    const processRuleBreakdown = (ruleTotals: Record<string, number>): RuleBreakdownEntry[] => {
        const aggregatedByName: Record<string, { totalValue: number, originalName: string, emoji?: string }> = {};
        Object.entries(ruleTotals).forEach(([ruleId, totalValue]) => {
            const ruleDetails = ruleIdToDetailsMap.get(ruleId);
            if (ruleDetails) {
                const normalizedName = ruleDetails.name.trim().toLowerCase();
                if (!aggregatedByName[normalizedName]) {
                    aggregatedByName[normalizedName] = { totalValue: 0, originalName: ruleDetails.name, emoji: ruleDetails.emoji };
                }
                aggregatedByName[normalizedName].totalValue += totalValue;
            }
        });
        return Object.values(aggregatedByName)
            .map(data => ({ name: data.originalName, totalValue: data.totalValue, emoji: data.emoji }))
            .sort((a, b) => b.totalValue - a.totalValue);
    };

    // --- Agent Top Trumps Cards ---
    const finalAgentCards: TopTrumpEntry[] = Object.entries(agentData).map(([id, data]) => {
        const user = users.find(u => u.id === id);
        return {
            id,
            name: user?.name || 'Unknown Agent',
            score: data.score,
            avatarUrl: user?.avatarUrl,
            avatarInitials: user?.avatarInitials,
            avatarBgColor: user?.avatarBgColor,
            ruleBreakdown: processRuleBreakdown(data.ruleTotals),
        };
    }).sort((a, b) => b.score - a.score);
    
    // --- Pod Top Trumps Cards ---
    const finalPodCards: TopTrumpEntry[] = Object.entries(podData).map(([id, data]) => {
        const pod = pods.find(p => p.id === id);
        return { 
            id, 
            name: pod?.name || 'Unknown Pod',
            score: data.score,
            avatarUrl: pod?.logoUrl,
            avatarInitials: pod?.logoInitials,
            avatarBgColor: pod?.logoBgColor,
            ruleBreakdown: processRuleBreakdown(data.ruleTotals),
        };
    }).sort((a,b) => b.score - a.score);
    
    return { totalPoints, totalAchievements, agentCards: finalAgentCards, podCards: finalPodCards, ruleBreakdown: finalRuleBreakdown };
  }, [filteredLogs, pods, allRules, users]);

  const yearOptions = useMemo(() => {
      const currentYear = getYear(new Date());
      return Array.from({ length: 5 }, (_, i) => String(currentYear - i));
  }, []);

  const summaryCards = [
    { title: "Total Points Awarded", value: totalPoints.toLocaleString(), icon: <Star className="text-muted-foreground" /> },
    { title: "Total Achievements Logged", value: totalAchievements.toLocaleString(), icon: <TrendingUp className="text-muted-foreground" /> },
    { title: "Active Agents", value: agentCards.length.toLocaleString(), icon: <Users className="text-muted-foreground" /> },
    { title: "Active Pods", value: podCards.length.toLocaleString(), icon: <Sigma className="text-muted-foreground" /> },
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
                    <SelectContent>
                        <SelectItem value="period">Time Period</SelectItem>
                        <SelectItem value="competition">Competition</SelectItem>
                        <SelectItem value="year">Year</SelectItem>
                    </SelectContent>
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
            
             {filterType === 'year' && (
                 <div className="grid gap-2">
                    <Label>Year</Label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
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
      
      {error && <Card className="frosted-glass text-destructive bg-destructive/10"><CardContent className="p-4 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</CardContent></Card>}

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
                            <Card key={rule.name} className="shadow-sm hover:shadow-md transition-shadow">
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

        {/* Pod Top Trumps Section */}
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Pod Leaderboard</h2>
            {podCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {podCards.map(pod => (
                        <Card key={pod.id} className="frosted-glass shadow-lg flex flex-col">
                            <CardHeader className="flex flex-row items-center gap-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback
                                        initials={pod.avatarInitials || generateInitials(pod.name)}
                                        backgroundColor={pod.avatarBgColor}
                                    />
                                </Avatar>
                                <div className="flex-1">
                                    <CardTitle className="truncate" title={pod.name}>{pod.name}</CardTitle>
                                    <CardDescription className="font-bold text-lg text-primary">{pod.score.toLocaleString()} Points</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Achievement</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {pod.ruleBreakdown.map(rule => (
                                            <TableRow key={rule.name}>
                                                <TableCell className="font-medium truncate">{rule.emoji} {rule.name}</TableCell>
                                                <TableCell className="text-right">{rule.totalValue.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-4">No pod data available for the selected filters.</p>
            )}
        </div>

        {/* Agent Top Trumps Section */}
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Agent Leaderboard</h2>
             {agentCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {agentCards.map(agent => (
                        <Card key={agent.id} className="frosted-glass shadow-lg flex flex-col">
                            <CardHeader className="flex flex-row items-center gap-4">
                                <Avatar className="h-12 w-12">
                                    <AvatarFallback
                                        initials={agent.avatarInitials || generateInitials(agent.name)}
                                        backgroundColor={agent.avatarBgColor}
                                    />
                                </Avatar>
                                <div className="flex-1">
                                    <CardTitle className="truncate" title={agent.name}>{agent.name}</CardTitle>
                                    <CardDescription className="font-bold text-lg text-primary">{agent.score.toLocaleString()} Points</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Achievement</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {agent.ruleBreakdown.map(rule => (
                                            <TableRow key={rule.name}>
                                                <TableCell className="font-medium truncate">{rule.emoji} {rule.name}</TableCell>
                                                <TableCell className="text-right">{rule.totalValue.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                 <p className="text-muted-foreground text-center py-4">No agent data available for the selected filters.</p>
            )}
        </div>
    </div>
  );
}
