
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Leaderboard } from '@/components/leaderboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';
import type { RuleFormData } from '@/models/types';

interface AgentLeaderboardWidgetProps {
  currentUser: AppUser | null;
}

const AGENT_LEADERBOARD_COMP_KEY = 'agentLeaderboard_selectedCompId';

interface CompetitionWithRules extends Competition {
  rules: RuleFormData[];
  id: string;
}

export function AgentLeaderboardWidget({ currentUser }: AgentLeaderboardWidgetProps) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithRules[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);

  // Effect 1: Fetch all possible competitions for the user's pod
  useEffect(() => {
    if (!currentUser?.podId) return;

    const compQuery = query(
        collection(db, 'competitions'),
        where('podIds', 'array-contains', currentUser.podId),
        orderBy('startDate', 'desc')
    );
    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithRules));
        setAllCompetitions(fetchedComps);
        
        // Set default competition if not already set, or if current selection is invalid
        if (!selectedCompetitionId || !fetchedComps.some(c => c.id === selectedCompetitionId)) {
            const savedCompId = localStorage.getItem(AGENT_LEADERBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else if (fetchedComps.length > 0) {
                 setSelectedCompetitionId(fetchedComps[0].id);
            }
        }
        setIsLoading(false); // Initial load of competitions is done
    });
    return () => unsubscribe();
  }, [currentUser?.podId]);


  // Effect 2: Fetch agents and competition-specific logs when selection changes
  useEffect(() => {
    if (!selectedCompetitionId || !currentUser?.podId) {
        setPodAgents([]);
        setCompetitionLogs([]);
        return;
    }
    
    const selectedCompetition = allCompetitions.find(c => c.id === selectedCompetitionId);
    if (!selectedCompetition) {
        return;
    }

    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    // Fetch agents for the pod
    const agentsQuery = query(collection(db, 'users'), where('podId', '==', currentUser.podId));
    unsubscribes.push(onSnapshot(agentsQuery, (snapshot) => {
        setPodAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }));

    // Fetch all logs for the pod within the selected competition's date range
    const logsQuery = query(
        collection(db, 'dailyAchievements'),
        where('competitionId', '==', selectedCompetitionId),
        where('podId', '==', currentUser.podId),
        where('date', '>=', selectedCompetition.startDate),
        where('date', '<=', selectedCompetition.endDate)
    );
    unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
        setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching competition logs:", error);
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());

  }, [selectedCompetitionId, currentUser?.podId, allCompetitions]);

  const handleCompetitionChange = (value: string) => {
    setSelectedCompetitionId(value);
    localStorage.setItem(AGENT_LEADERBOARD_COMP_KEY, value);
  };

  const agentLeaderboard = useMemo(() => {
    if (isLoading || podAgents.length === 0) {
      return [];
    }

    const agentScores = podAgents.reduce((acc, agent) => {
      acc[agent.id!] = competitionLogs
        .filter(log => log.agentId === agent.id)
        .reduce((sum, log) => {
            const points = log.points ?? 0;
            return sum + points;
        }, 0);
      return acc;
    }, {} as Record<string, number>);

    return podAgents.map(agent => ({
      id: agent.id!,
      name: agent.name,
      score: agentScores[agent.id!] || 0,
      avatarUrl: agent.avatarUrl,
      avatarInitials: agent.avatarInitials,
      avatarBgColor: agent.avatarBgColor,
      isUser: agent.id === currentUser?.id,
    }));
  }, [isLoading, competitionLogs, podAgents, currentUser]);


  const selectedCompetition = allCompetitions.find(c => c.id === selectedCompetitionId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Agent Leaderboard
            </div>
            <Select
                value={selectedCompetitionId}
                onValueChange={handleCompetitionChange}
                disabled={allCompetitions.length === 0}
            >
                <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Select Competition" />
                </SelectTrigger>
                <SelectContent>
                    {allCompetitions.map(comp => (
                        <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardTitle>
        {selectedCompetition && <CardDescription>Pod ranking for competition: {selectedCompetition.name}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
            <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        ) : (
             <Leaderboard entries={agentLeaderboard} />
        )}
      </CardContent>
    </Card>
  );
}
