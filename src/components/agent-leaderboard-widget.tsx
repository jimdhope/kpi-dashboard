
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { CompetitionWithRules } from '@/app/(agent)/agent/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Leaderboard } from '@/components/leaderboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy } from 'lucide-react';

interface AgentLeaderboardWidgetProps {
  allCompetitions: CompetitionWithRules[];
  podId: string | null;
  currentUser: AppUser | null;
}

export function AgentLeaderboardWidget({ allCompetitions, podId, currentUser }: AgentLeaderboardWidgetProps) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);

  useEffect(() => {
    // Set default competition to the most recent one when the component mounts or competitions change
    if (allCompetitions.length > 0 && !selectedCompetitionId) {
      setSelectedCompetitionId(allCompetitions[0].id);
    }
  }, [allCompetitions, selectedCompetitionId]);

  useEffect(() => {
    if (!selectedCompetitionId || !podId) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    let logsUnsubscribe: Unsubscribe | undefined;
    let agentsUnsubscribe: Unsubscribe | undefined;

    try {
        const logsQuery = query(
            collection(db, 'dailyAchievements'),
            where('competitionId', '==', selectedCompetitionId),
            where('podId', '==', podId)
        );
        logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
            setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
            setIsLoading(false); // Set loading false after logs are fetched
        });

        const agentsQuery = query(collection(db, 'users'), where('podId', '==', podId));
        agentsUnsubscribe = onSnapshot(agentsQuery, (snapshot) => {
            setPodAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
        });

    } catch (error) {
        console.error("Error fetching leaderboard data:", error);
        setIsLoading(false);
    }

    return () => {
        if (logsUnsubscribe) logsUnsubscribe();
        if (agentsUnsubscribe) agentsUnsubscribe();
    };

  }, [selectedCompetitionId, podId]);


  const agentLeaderboard = useMemo(() => {
    if (isLoading || podAgents.length === 0) {
      return [];
    }

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
                onValueChange={setSelectedCompetitionId}
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
