'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AppUser {
  id: string;
  name: string;
  podId?: string | null;
}

interface TrackerKpi {
  id: string;
  name: string;
  unit?: string;
}

interface TrackerLog {
  id: string;
  userId: string;
  trackerKpiId: string;
  value: number;
  loggedAt: string;
}

interface Pod {
  id: string;
  name: string;
}

type TimeFrame = 'today' | 'thisWeek' | 'thisMonth' | 'custom';

function getDateRange(timeFrame: TimeFrame, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  switch (timeFrame) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'thisWeek':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'custom':
      return { start: customStart ? startOfDay(customStart) : startOfDay(now), end: customEnd ? endOfDay(customEnd) : endOfDay(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export default function TrackersDashboard() {
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('today');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpisRes, podsRes, usersRes, logsRes] = await Promise.all([
          fetch('/api/trackers'),
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/performance/logs'),
        ]);

        if (kpisRes.ok) {
          const data = await kpisRes.json();
          setTrackerKpis(data.kpis || []);
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setAgents((data.users || []).filter((u: AppUser) => u.name));
        }
        if (logsRes.ok) {
          const data = await logsRes.json();
          setTrackerLogs(Array.isArray(data) ? data : (data.logs || []));
        }
      } catch (error) {
        console.error("Error fetching trackers data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const { start: rangeStart, end: rangeEnd } = getDateRange(timeFrame, customStartDate, customEndDate);

  const filteredLogs = useMemo(() => {
    return trackerLogs.filter(log => {
      if (!log.loggedAt) return false;
      const logDate = new Date(log.loggedAt);
      return logDate >= rangeStart && logDate <= rangeEnd;
    });
  }, [trackerLogs, rangeStart, rangeEnd]);

  const agentTrackerCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    filteredLogs.forEach(log => {
      if (!counts[log.userId]) counts[log.userId] = {};
      if (!counts[log.userId][log.trackerKpiId]) counts[log.userId][log.trackerKpiId] = 0;
      counts[log.userId][log.trackerKpiId] += log.value;
    });
    return counts;
  }, [filteredLogs]);

  const leaderboardData = useMemo(() => {
    if (trackerKpis.length === 0) return [];
    
    const agentIds = Object.keys(agentTrackerCounts);
    if (agentIds.length === 0) return [];

    return agentIds
      .map(agentId => {
        const agent = agents.find(a => a.id === agentId);
        const pod = pods.find(p => p.id === agent?.podId);
        const trackerValues: Record<string, number> = {};
        let total = 0;
        
        trackerKpis.forEach(kpi => {
          const value = agentTrackerCounts[agentId]?.[kpi.id] || 0;
          trackerValues[kpi.id] = value;
          total += value;
        });

        return {
          agentId,
          agentName: agent?.name || 'Unknown',
          podName: pod?.name || 'Unknown Pod',
          trackerValues,
          total,
        };
      })
      .filter(entry => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [trackerKpis, agentTrackerCounts, agents, pods]);

  const getTimeFrameLabel = () => {
    switch (timeFrame) {
      case 'today':
        return 'Today';
      case 'thisWeek':
        return 'This Week';
      case 'thisMonth':
        return 'This Month';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'MMM d')} - ${format(customEndDate, 'MMM d')}`;
        }
        return 'Custom';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <Card variant="glass">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Trackers Leaderboard</h1>
          <p className="text-muted-foreground">Agent rankings by tracker achievements</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border bg-card">
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-r-none", timeFrame === 'today' && "bg-primary text-primary-foreground")}
              onClick={() => setTimeFrame('today')}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-none border-x", timeFrame === 'thisWeek' && "bg-primary text-primary-foreground")}
              onClick={() => setTimeFrame('thisWeek')}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("rounded-l-none", timeFrame === 'thisMonth' && "bg-primary text-primary-foreground")}
              onClick={() => setTimeFrame('thisMonth')}
            >
              Month
            </Button>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("w-[160px] sm:w-[200px] justify-start text-left font-normal", timeFrame === 'custom' && "bg-primary/10 border-primary")}
              >
                <span className="mr-2">📅</span>
                {getTimeFrameLabel()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">Start Date</label>
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={(date) => setCustomStartDate(date)}
                      fromDate={new Date('2024-01-01')}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-xs text-muted-foreground">End Date</label>
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={(date) => setCustomEndDate(date)}
                      fromDate={customStartDate || new Date('2024-01-01')}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setTimeFrame('custom');
                      if (!customStartDate) setCustomStartDate(new Date());
                      if (!customEndDate) setCustomEndDate(new Date());
                    }}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomStartDate(undefined);
                      setCustomEndDate(undefined);
                      setTimeFrame('today');
                    }}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Card variant="glass">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Agent Leaderboard
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {leaderboardData.length} {leaderboardData.length === 1 ? 'agent' : 'agents'} with achievements
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaderboardData.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No tracker achievements for this period</p>
              <p className="text-sm text-muted-foreground/60 mb-4">Log scores to see agents here</p>
              <Button asChild variant="secondary">
                <a href="/trackers/log">Log Daily Trackers</a>
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[60px] text-center">#</TableHead>
                      <TableHead className="w-[200px]">Agent</TableHead>
                      <TableHead className="w-[150px]">Pod</TableHead>
                      {trackerKpis.map(kpi => (
                        <TableHead key={kpi.id} className="text-center min-w-[80px]">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-base">📋</span>
                            <span className="text-[10px] font-normal text-muted-foreground max-w-[60px] truncate" title={kpi.name}>
                              {kpi.name}
                            </span>
                          </div>
                        </TableHead>
                      ))}
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboardData.map((entry, index) => (
                      <TableRow key={entry.agentId} className={index % 2 === 0 ? 'bg-muted/20' : ''}>
                        <TableCell className="text-center">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mx-auto",
                            index === 0 ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/50' :
                            index === 1 ? 'bg-gray-400/30 text-gray-300 border border-gray-400/50' :
                            index === 2 ? 'bg-orange-400/30 text-orange-400 border border-orange-400/50' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {index + 1}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">
                                {generateInitials(entry.agentName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{entry.agentName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{entry.podName}</span>
                        </TableCell>
                        {trackerKpis.map(kpi => (
                          <TableCell key={kpi.id} className="text-center">
                            {entry.trackerValues[kpi.id] || '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">
                          {entry.total}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 max-h-[500px] overflow-y-auto">
                {leaderboardData.map((entry, index) => (
                  <div 
                    key={entry.agentId} 
                    className={cn(
                      "p-3 rounded-lg border",
                      index === 0 && 'border-yellow-500/30 bg-yellow-500/5',
                      index === 1 && 'border-gray-400/30 bg-gray-400/5',
                      index === 2 && 'border-orange-400/30 bg-orange-400/5',
                      index > 2 && 'bg-card'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                          index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/30 text-gray-300' :
                          index === 2 ? 'bg-orange-400/30 text-orange-400' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {generateInitials(entry.agentName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-sm">{entry.agentName}</span>
                            <span className="text-xs text-muted-foreground block">{entry.podName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">{entry.total}</span>
                        <span className="text-xs text-muted-foreground block">total</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {trackerKpis.map(kpi => (
                        <div key={kpi.id} className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                          <span>📋</span>
                          <span className="text-muted-foreground">{entry.trackerValues[kpi.id] || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
