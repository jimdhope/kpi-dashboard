
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  Timestamp,
  doc,
  getDoc,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Leaderboard } from '@/components/leaderboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert";
import { AlertCircle, BarChart, Users } from 'lucide-react';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';

// Interface for leaderboard entries
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
}

// Team structure within Competition
interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

interface CompetitionWithRules extends Competition {
    teams?: Team[];
    id: string;
}

const assignDenseRanks = <T extends { score: number }>(items: T[]): (T & { rank: number })[] => {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    const sortedItems = [...items].sort((a, b) => (b.score || 0) - (a.score || 0));
    const scoreRankMap = new Map<number, number>();
    let rankCounter = 1;
    for (const item of sortedItems) {
        const score = item.score || 0;
        if (!scoreRankMap.has(score)) {
            scoreRankMap.set(score, rankCounter++);
        }
    }
    return sortedItems.map(item => {
        const score = item.score || 0;
        const rank = scoreRankMap.get(score)!;
        return { ...item, rank };
    });
};


export default function PublicPodLeaderboardPage({ params }: { params: { podId: string } }) {
  const { podId } = params;

  const [pod, setPod] = useState<Pod | null>(null);
  const [activeCompetition, setActiveCompetition] = useState<CompetitionWithRules | null>(null);
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!podId) {
      setError("No Pod ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch Pod details once
        const podDocRef = doc(db, 'pods', podId);
        const podDocSnap = await getDoc(podDocRef);
        if (!podDocSnap.exists()) {
          throw new Error("The specified pod could not be found.");
        }
        if (isMounted) {
            const fetchedPod = { id: podDocSnap.id, ...podDocSnap.data() } as Pod;
            setPod(fetchedPod);

            // Fetch agents for this pod
            const agentsQuery = query(collection(db, 'users'), where('podId', '==', podId), where('roles', 'array-contains', 'agent'));
            const agentsSnapshot = await getDocs(agentsQuery);
            const fetchedAgents = agentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
             if (isMounted) setPodAgents(fetchedAgents);


            // Find the active competition for this pod
            const today = new Date();
            const competitionsQuery = query(
              collection(db, 'competitions'),
              where('podIds', 'array-contains', podId),
               orderBy('startDate', 'desc')
            );
            const competitionSnapshot = await getDocs(competitionsQuery);
            let foundCompetition: CompetitionWithRules | null = null;
            for (const docSnap of competitionSnapshot.docs) {
                const comp = { id: docSnap.id, ...docSnap.data() } as CompetitionWithRules;
                if (comp.startDate.toDate() <= today && comp.endDate.toDate() >= today) {
                    foundCompetition = comp;
                    break;
                }
            }

            if (isMounted && foundCompetition) {
              setActiveCompetition(foundCompetition);
              setTeams(foundCompetition.teams || []);

              // Listen for real-time achievement logs for this competition and pod
              const logsQuery = query(
                collection(db, 'dailyAchievements'),
                where('competitionId', '==', foundCompetition.id),
                where('podId', '==', podId)
              );
              const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
                const fetchedLogs = snapshot.docs.map(d => d.data() as DailyAchievementLog);
                if(isMounted) setAchievementLogs(fetchedLogs);
              }, (err) => {
                console.error("Error fetching achievement logs:", err);
                if(isMounted) setError("Could not load leaderboard data.");
              });
              unsubscribes.push(logsUnsubscribe);
            } else if (isMounted) {
              setError("No active competition found for this pod.");
            }
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        if(isMounted) setError(err.message || "An error occurred while loading data.");
      } finally {
        if(isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
        isMounted = false;
        unsubscribes.forEach(unsub => unsub());
    };
  }, [podId]);

  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
    if (!activeCompetition || podAgents.length === 0) {
      return { agentLeaderboard: [], teamLeaderboard: [] };
    }

    // Agent calculations
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { agentScores[agent.id!] = 0; });
    achievementLogs.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId] += log.points || 0;
      }
    });
    const agentLeaderboardData = podAgents.map(agent => ({
      id: agent.id!,
      name: agent.name,
      score: agentScores[agent.id!] || 0,
      avatarInitials: agent.avatarInitials,
      avatarBgColor: agent.avatarBgColor,
    }));

    // Team calculations
    const teamScores: Record<string, number> = {};
    teams.forEach(team => { teamScores[team.id] = 0; });
    achievementLogs.forEach(log => {
      const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
      if (agentTeam) {
        teamScores[agentTeam.id] += log.points || 0;
      }
    });
    const teamLeaderboardData = teams.map(team => ({
      id: team.id,
      name: team.name,
      score: teamScores[team.id] || 0,
      avatarInitials: team.name.substring(0, 2),
    }));

    return {
      agentLeaderboard: assignDenseRanks(agentLeaderboardData),
      teamLeaderboard: assignDenseRanks(teamLeaderboardData),
    };
  }, [achievementLogs, podAgents, teams, activeCompetition]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] w-full" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive" className="frosted-glass">
          <AlertCircle className="h-4 w-4" />
          <UIDescription>{error}</UIDescription>
        </Alert>
      );
    }

    return (
      <div className="grid md:grid-cols-2 gap-6">
        <Leaderboard
          title="Agent Leaderboard"
          entries={agentLeaderboard}
          isStickyHeader={false}
        />
        <Leaderboard
          title="Team Leaderboard"
          entries={teamLeaderboard}
          isStickyHeader={false}
        />
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="mb-6 frosted-glass">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl flex items-center gap-3">
             {isLoading ? <Skeleton className="h-8 w-48" /> : `Live Leaderboard: ${pod?.name || 'Pod'}`}
          </CardTitle>
          <CardDescription>
            {isLoading ? <Skeleton className="h-4 w-64" /> : `Showing results for competition: ${activeCompetition?.name || 'N/A'}`}
          </CardDescription>
        </CardHeader>
      </Card>
      {renderContent()}
    </div>
  );
}
