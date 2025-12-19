
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart3, Filter, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Leaderboard } from '@/components/leaderboard';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { AdditionalKpi, AdditionalKpiType } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
}

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'allTime';

const LEADERBOARD_POD_KEY = 'additionalLeaderboard_selectedPodId';
const LEADERBOARD_KPI_KEY = 'additionalLeaderboard_selectedKpiId';
const LEADERBOARD_TIMEFRAME_KEY = 'additionalLeaderboard_timeframe';


export default function AdditionalLeaderboardPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [selectedKpiId, setSelectedKpiId] = useState<string>('overall');
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');
  
  const [isLoading, setIsLoading] = useState(true);

  // Load saved filters
  useEffect(() => {
    const savedPodId = localStorage.getItem(LEADERBOARD_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
    const savedKpiId = localStorage.getItem(LEADERBOARD_KPI_KEY);
    if (savedKpiId) setSelectedKpiId(savedKpiId);
    const savedTimeframe = localStorage.getItem(LEADERBOARD_TIMEFRAME_KEY) as Timeframe | null;
    if (savedTimeframe) setTimeframe(savedTimeframe);
  }, []);

  const handlePodChange = (podId: string) => { setSelectedPodId(podId); localStorage.setItem(LEADERBOARD_POD_KEY, podId); };
  const handleKpiChange = (kpiId: string) => { setSelectedKpiId(kpiId); localStorage.setItem(LEADERBOARD_KPI_KEY, kpiId); };
  const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(LEADERBOARD_TIMEFRAME_KEY, tf); };

  // Fetch base data (pods, kpis, users)
  useEffect(() => {
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];
    
    unsubscribes.push(onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))));
    unsubscribes.push(onSnapshot(query(collection(db, 'users'), orderBy('name')), (snap) => {
        setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Fetch logs based on pod filter (all time)
  useEffect(() => {
    if (!selectedPodId) {
      setLogs([]);
      return;
    }
    setIsLoading(true);
    const logsQuery = query(collection(db, 'additionalKpiLogs'), where('podId', '==', selectedPodId));
    const unsubscribe = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog)));
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching logs:", err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedPodId]);
  
  const filteredLogs = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    switch (timeframe) {
      case 'daily':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        startDate = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'allTime':
      default:
        return logs;
    }
    return logs.filter(log => log.date.toDate() >= startDate);
  }, [logs, timeframe]);

  const leaderboardData = useMemo((): LeaderboardEntry[] => {
    const podAgents = agents.filter(a => a.podId === selectedPodId && a.roles?.includes('agent'));
    if (podAgents.length === 0) return [];
  
    let logsToProcess = filteredLogs;
    let kpi: AdditionalKpi | undefined;
  
    if (selectedKpiId !== 'overall') {
      kpi = kpis.find(k => k.id === selectedKpiId);
      if (kpi) {
        logsToProcess = filteredLogs.filter(log => log.kpiId === selectedKpiId);
      }
    }
  
    const agentScores: Record<string, { totalValue: number; count: number }> = {};
    podAgents.forEach(agent => agent.id && (agentScores[agent.id] = { totalValue: 0, count: 0 }));
  
    logsToProcess.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId].totalValue += log.value;
        agentScores[log.agentId].count++;
      }
    });
  
    // Determine the final score for each agent based on the KPI type
    return podAgents.map(agent => {
      const agentData = agent.id ? agentScores[agent.id] : { totalValue: 0, count: 0 };
      let finalScore = 0;
  
      if (kpi && kpi.type === 'percentage') {
        finalScore = agentData.count > 0 ? (agentData.totalValue / agentData.count) : 0;
      } else {
        // For 'number', 'scoreOutOf', or 'overall', the score is the sum
        finalScore = agentData.totalValue;
      }
  
      return {
        id: agent.id!,
        name: agent.name,
        score: finalScore,
        avatarUrl: agent.avatarUrl,
        avatarInitials: agent.avatarInitials,
        avatarBgColor: agent.avatarBgColor,
      };
    }).sort((a, b) => {
        // Sort based on the KPI's sortOrder
        if (kpi?.sortOrder === 'asc') { // Lower is better
            return a.score - b.score;
        }
        return b.score - a.score; // Higher is better (default)
    });
  }, [filteredLogs, agents, selectedPodId, selectedKpiId, kpis]);
  

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Leaderboard Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="pod-select">Pod</Label>
              <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}><SelectTrigger id="pod-select"><SelectValue placeholder="Select Pod" /></SelectTrigger><SelectContent>{pods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kpi-select">KPI</Label>
              <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}><SelectTrigger id="kpi-select"><SelectValue placeholder="Select KPI" /></SelectTrigger><SelectContent><SelectItem value="overall">Overall Score</SelectItem>{kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.emoji} {k.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timeframe-select">Timeframe</Label>
              <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}><SelectTrigger id="timeframe-select"><SelectValue placeholder="Select Timeframe" /></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="allTime">All Time</SelectItem></SelectContent></Select>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Additional KPI Leaderboard</CardTitle>
          <CardDescription>Ranking based on the selected filters.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2"><Skeleton className="h-[300px] w-full" /></div>
          ) : !selectedPodId ? (
            <p className="text-muted-foreground text-center py-6">Please select a pod to view the leaderboard.</p>
          ) : (
            <Leaderboard entries={leaderboardData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
