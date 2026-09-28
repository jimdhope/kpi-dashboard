'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, TrendingDown, Filter, Download } from "lucide-react";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials, cn } from '@/lib/utils';
import {
  buildKpiLeaderboards,
  formatLeaderboardScore,
  type PerformanceTimeframe,
} from '@/lib/performance-scoring';
import type { AppPod } from '@/lib/contracts';

type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';
type KpiSortOrder = 'desc' | 'asc';

interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder?: KpiSortOrder;
}

interface AdditionalKpiLog {
  id: string;
  kpiId: string;
  userId: string | null;
  userName: string | null;
  value: number;
  date: string;
}

interface AppUser {
  id: string;
  name: string;
}

type Timeframe = PerformanceTimeframe;

const getMedalStyle = (rank: number) => {
  switch (rank) {
    case 1: return 'bg-yellow-500/30 text-yellow-400 border-yellow-500/50';
    case 2: return 'bg-gray-400/30 text-gray-300 border-gray-400/50';
    case 3: return 'bg-orange-400/30 text-orange-400 border-orange-400/50';
    default: return 'bg-muted/30 text-muted-foreground border-muted';
  }
};

export default function PerformanceDashboard() {
  const [pods, setPods] = useState<AppPod[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);
  const [selectedPodId, setSelectedPodId] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<Timeframe>('thisWeek');
  const [isLoading, setIsLoading] = useState(true);
  const hasLoaded = React.useRef(false);

  useEffect(() => {
    const savedPod = localStorage.getItem('performanceDashboard_selectedPodId');
    if (savedPod) setSelectedPodId(savedPod);
    const savedTf = localStorage.getItem('performanceDashboard_timeframe') as Timeframe | null;
    if (savedTf) setTimeframe(savedTf);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const q = selectedPodId !== 'all' ? `?podId=${encodeURIComponent(selectedPodId)}` : '';
        const res = await fetch(`/api/performance/dashboard${q}`);
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();
        setPods(data.pods || []);
        setKpis(data.kpis || []);
        setAgents(data.users || []);
        setLogs(data.logs || []);
        hasLoaded.current = true;
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    async function fetchLogs() {
      setIsLoading(true);
      try {
        const url = selectedPodId !== 'all' ? `/api/performance/kpi-logs?podId=${selectedPodId}` : '/api/performance/kpi-logs';
        const res = await fetch(url);
        if (res.ok) setLogs((await res.json()).logs || []);
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    }
    fetchLogs();
  }, [selectedPodId]);

  const handlePodChange = (id: string) => { setSelectedPodId(id); localStorage.setItem('performanceDashboard_selectedPodId', id); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem('performanceDashboard_timeframe', tf); };

  const handleDownloadCert = async (kpiId: string) => {
    const params = new URLSearchParams({ timeframe });
    if (selectedPodId !== 'all') params.set('podId', selectedPodId);
    params.set('kpiId', kpiId);
    const res = await fetch(`/api/performance/certificate?${params}`);
    if (!res.ok) throw new Error("Failed to generate certificate");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    const kpi = kpis.find(k => k.id === kpiId);
    link.download = `performance-certificate-${kpi?.initials || "kpi"}-${timeframe}.png`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const handleDownloadAll = async () => {
    const params = new URLSearchParams({ timeframe, all: "true" });
    if (selectedPodId !== "all") params.set("podId", selectedPodId);
    const res = await fetch(`/api/performance/certificate?${params}`);
    if (!res.ok) throw new Error("Failed to generate certificates");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `performance-certificates-${timeframe}.zip`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const kpiLeaderboards = useMemo(
    () => buildKpiLeaderboards({ kpis, logs, users: agents, timeframe }),
    [kpis, logs, agents, timeframe],
  );

  const getTimeframeLabel = () => {
    switch (timeframe) {
      case 'thisWeek': return 'This Week';
      case 'thisMonth': return 'This Month';
      case 'last6weeks': return 'Last 6 Weeks';
      case 'allTime': return 'All Time';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div><Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
        <div className="flex gap-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-48" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-64" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Dashboard</h1>
          <p className="text-muted-foreground">KPI Performance Leaderboards</p>
        </div>
        <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors border border-primary/20">
          <Download className="h-4 w-4" /> Download All Certificates
        </button>
      </div>

      <Card className="frosted-glass">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="grid gap-2">
              <Label>Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Pod" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pods</SelectItem>
                  {pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Timeframe" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="thisWeek">This Week</SelectItem>
                  <SelectItem value="thisMonth">This Month</SelectItem>
                  <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                  <SelectItem value="allTime">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {kpis.length === 0 ? (
        <Card className="frosted-glass">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No KPIs Configured</p>
              <p className="text-sm">Add KPIs in the Additional KPIs section to see leaderboards.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiLeaderboards.map(({ kpi, entries }) => (
            <Card key={kpi.id} className="frosted-glass overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold">{kpi.initials || '📋'}</span>
                    </div>
                    <div>
                      <CardTitle className="text-base">{kpi.name}</CardTitle>
                      {kpi.type === 'percentage' && <span className="text-xs text-muted-foreground">{kpi.type}</span>}
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                    kpi.sortOrder === 'asc' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                  )}>
                    {kpi.sortOrder === 'asc' ? (
                      <><TrendingDown className="h-3 w-3" /><span>Lower is better</span></>
                    ) : (
                      <><TrendingUp className="h-3 w-3" /><span>Higher is better</span></>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                {entries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><p className="text-sm">No data for this KPI</p></div>
                ) : (
                  <div className="space-y-1">
                    {entries.map((entry) => (
                      <div key={entry.agentId} className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-colors",
                        entry.rank <= 3 ? 'bg-muted/50' : 'hover:bg-muted/30'
                      )}>
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border", getMedalStyle(entry.rank))}>
                          {entry.rank}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">{generateInitials(entry.agentName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{entry.agentName}</span>
                        </div>
                        <div className="text-right">
                          <span className={cn("font-bold tabular-nums", entry.rank <= 3 ? 'text-foreground' : 'text-primary')}>
                            {formatLeaderboardScore(kpi, entry.score)}
                          </span>
                          <button
                            onClick={() => handleDownloadCert(kpi.id)}
                            className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded border border-slate-500/50 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
                            title={`Download ${kpi.name} certificate`}
                            aria-label={`Download ${kpi.name} certificate`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
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

      {kpis.length > 0 && kpiLeaderboards.every(lb => lb.entries.length === 0) && (
        <Card className="frosted-glass">
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
