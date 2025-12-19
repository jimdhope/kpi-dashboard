
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Leaderboard } from '@/components/leaderboard';
import { Filter, Trophy } from 'lucide-react';

import type { AppUser } from '@/services/user';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AdditionalKpi } from '@/app/(admin)/admin/additional-kpis/page';
import type { AdditionalKpiLog } from '@/app/(admin)/admin/additional-scores/page';
import { subWeeks } from 'date-fns';

interface AdditionalKpiLeaderboardWidgetProps {
    currentUser: AppUser;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
  isUser?: boolean;
}

type Timeframe = 'weekly' | 'last6weeks' | 'monthly' | 'allTime';

const AGENT_WIDGET_LEADERBOARD_POD_KEY = 'agentWidget_leaderboard_selectedPodId';
const AGENT_WIDGET_LEADERBOARD_KPI_KEY = 'agentWidget_leaderboard_selectedKpiId';
const AGENT_WIDGET_LEADERBOARD_TIMEFRAME_KEY = 'agentWidget_leaderboard_timeframe';


export function AdditionalKpiLeaderboardWidget({ currentUser }: AdditionalKpiLeaderboardWidgetProps) {
    const [pods, setPods] = useState<Pod[]>([]);
    const [agents, setAgents] = useState<AppUser[]>([]);
    const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
    const [logs, setLogs] = useState<AdditionalKpiLog[]>([]);

    const [selectedPodId, setSelectedPodId] = useState<string>(currentUser.podId || 'all');
    const [selectedKpiId, setSelectedKpiId] = useState<string>('overall');
    const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
    
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const savedPodId = localStorage.getItem(AGENT_WIDGET_LEADERBOARD_POD_KEY);
        if (savedPodId) setSelectedPodId(savedPodId);
        const savedKpiId = localStorage.getItem(AGENT_WIDGET_LEADERBOARD_KPI_KEY);
        if (savedKpiId) setSelectedKpiId(savedKpiId);
        const savedTimeframe = localStorage.getItem(AGENT_WIDGET_LEADERBOARD_TIMEFRAME_KEY) as Timeframe | null;
        if (savedTimeframe) setTimeframe(savedTimeframe);
    }, []);

    const handlePodChange = (podId: string) => { setSelectedPodId(podId); localStorage.setItem(AGENT_WIDGET_LEADERBOARD_POD_KEY, podId); };
    const handleKpiChange = (kpiId: string) => { setSelectedKpiId(kpiId); localStorage.setItem(AGENT_WIDGET_LEADERBOARD_KPI_KEY, kpiId); };
    const handleTimeframeChange = (tf: string) => { setTimeframe(tf as Timeframe); localStorage.setItem(AGENT_WIDGET_LEADERBOARD_TIMEFRAME_KEY, tf); };

    useEffect(() => {
        setIsLoading(true);
        const unsubscribes = [
            onSnapshot(query(collection(db, 'pods'), orderBy('name')), (snap) => setPods(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pod)))),
            onSnapshot(query(collection(db, 'additionalKpis'), orderBy('name')), (snap) => setKpis(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpi)))),
            onSnapshot(query(collection(db, 'users'), where('roles', 'array-contains', 'agent')), (snap) => setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)))),
            onSnapshot(query(collection(db, 'additionalKpiLogs')), (snap) => setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdditionalKpiLog))))
        ];
        Promise.all(unsubscribes.map(() => new Promise(res => setTimeout(res, 0)))).finally(() => setIsLoading(false));
        return () => unsubscribes.forEach(unsub => unsub());
    }, []);

    const filteredLogs = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        switch (timeframe) {
          case 'weekly':
            startDate = new Date(now.setDate(now.getDate() - now.getDay()));
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'last6weeks':
            startDate = subWeeks(now, 6);
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
        const podAgents = selectedPodId === 'all'
          ? agents
          : agents.filter(a => a.podId === selectedPodId);
        
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
      
        return podAgents.map(agent => {
          const agentData = agent.id ? agentScores[agent.id] : { totalValue: 0, count: 0 };
          let finalScore = 0;
      
          if (kpi && kpi.type === 'percentage') {
            finalScore = agentData.count > 0 ? (agentData.totalValue / agentData.count) : 0;
          } else {
            finalScore = agentData.totalValue;
          }
      
          return {
            id: agent.id!,
            name: agent.name,
            score: finalScore,
            avatarUrl: agent.avatarUrl,
            avatarInitials: agent.avatarInitials,
            avatarBgColor: agent.avatarBgColor,
            isUser: agent.id === currentUser.id
          };
        }).sort((a, b) => (kpi && kpi.sortOrder === 'asc') ? a.score - b.score : b.score - a.score);
    }, [filteredLogs, agents, selectedPodId, selectedKpiId, kpis, currentUser]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-primary" /> Performance Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="grid gap-2">
                        <Label htmlFor="pod-select">Pod</Label>
                        <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading}>
                            <SelectTrigger id="pod-select"><SelectValue placeholder="Select Pod" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Pods</SelectItem>
                                <SelectItem value={currentUser.podId!}>My Pod</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="kpi-select">KPI</Label>
                        <Select onValueChange={handleKpiChange} value={selectedKpiId} disabled={isLoading}>
                            <SelectTrigger id="kpi-select"><SelectValue placeholder="Select KPI" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="overall">Overall Score</SelectItem>
                                {kpis.map(k => <SelectItem key={k.id} value={k.id}>{k.initials} {k.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="timeframe-select">Timeframe</Label>
                        <Select onValueChange={handleTimeframeChange} value={timeframe} disabled={isLoading}>
                            <SelectTrigger id="timeframe-select"><SelectValue placeholder="Select Timeframe" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="last6weeks">Last 6 Weeks</SelectItem>
                                <SelectItem value="allTime">All Time</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {isLoading ? (
                    <div className="space-y-2"><Skeleton className="h-[200px] w-full" /></div>
                ) : (
                    <Leaderboard entries={leaderboardData} />
                )}
            </CardContent>
        </Card>
    );
}
