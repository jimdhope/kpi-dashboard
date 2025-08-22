
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  getDocs,
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

interface AgentLeaderboardWidgetProps {
  currentUser: AppUser | null;
}

const AGENT_LEADERBOARD_COMP_KEY = 'agentLeaderboard_selectedCompId';

export function AgentLeaderboardWidget({ currentUser }: AgentLeaderboardWidgetProps) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);

  // Fetch all possible competitions for the user's pod
  useEffect(() => {
    if (!currentUser?.podId) return;

    const compQuery = query(
        collection(db, 'competitions'),
        where('podIds', 'array-contains', currentUser.podId),
        orderBy('startDate', 'desc')
    );
    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
        setAllCompetitions(fetchedComps);
        // Set default competition if not already set
        if (!selectedCompetitionId && fetchedComps.length > 0) {
            const savedCompId = localStorage.getItem(AGENT_LEADERBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else {
                 setSelectedCompetitionId(fetchedComps[0].id);
            }
        }
    });
    return () => unsubscribe();
  }, [currentUser?.podId, selectedCompetitionId]);


  // Fetch agents and logs based on selected competition
  useEffect(() => {
    if (!selectedCompetitionId || !currentUser?.podId) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    // Fetch agents for the pod
    const agentsQuery = query(collection(db, 'users'), where('podId', '==', currentUser.podId));
    unsubscribes.push(onSnapshot(agentsQuery, (snapshot) => {
        setPodAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }));

    // Fetch all logs for the selected competition and pod
    const logsQuery = query(
        collection(db, 'dailyAchievements'),
        where('competitionId', '==', selectedCompetitionId),
        where('podId', '==', currentUser.podId)
    );
    unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
        setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());

  }, [selectedCompetitionId, currentUser?.podId]);

  const handleCompetitionChange = (value: string) => {
    setSelectedCompetitionId(value);
    localStorage.setItem(AGENT_LEADERBOARD_COMP_KEY, value);
  };

  const agentLeaderboard = useMemo(() => {
    if (isLoading || podAgents.length === 0) {
      return [];
    }
    // Correctly calculate score from `points` field in each log
    const agentScores = podAgents.reduce((acc, agent) => {
      acc[agent.id!] = competitionLogs
        .filter(log => log.agentId === agent.id)
        .reduce((sum, log) => sum + (log.points || 0), 0);
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
