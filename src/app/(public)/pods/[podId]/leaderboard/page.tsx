
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Leaderboard } from '@/components/leaderboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';

interface Pod {
  id: string;
  name: string;
  description?: string;
  campaignId?: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
  rules?: Array<{
    id: string;
    title: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
  }>;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

interface AchievementLog {
  id: string;
  competitionId: string;
  podId: string;
  agentId: string;
  points: number;
  createdAt: string;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank?: number;
  avatarUrl?: string;
  avatarInitials?: string;
  avatarBgColor?: string;
}

interface CompetitionWithRules extends Competition {
  teams?: Team[];
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
  const [podAgents, setPodAgents] = useState<Array<{ id: string; name: string; avatarInitials?: string; avatarBgColor?: string }>>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<AchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!podId) {
      setError("No Pod ID provided in the URL.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch Pod details
        const podRes = await fetch(`/api/pods/${podId}`);
        if (!podRes.ok) {
          throw new Error("The specified pod could not be found.");
        }
        const podData = await podRes.json();
        
        if (isMounted) {
            setPod(podData);
        }

        // Fetch members of this pod
        const membersRes = await fetch(`/api/pods/${podId}/members`);
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          if (isMounted) setPodAgents(membersData.members || []);
        }

        // Fetch active competition for this pod
        const compsRes = await fetch('/api/competitions');
        if (compsRes.ok) {
          const compsData = await compsRes.json();
          const competitions: Competition[] = compsData.competitions || [];
          
          const today = new Date();
          let foundCompetition: CompetitionWithRules | null = null;
          
          for (const comp of competitions) {
            const start = comp.startsAt ? new Date(comp.startsAt) : null;
            const end = comp.endsAt ? new Date(comp.endsAt) : null;
            
            if (start && end && start <= today && end >= today) {
              foundCompetition = comp as CompetitionWithRules;
              break;
            }
          }

          if (isMounted && foundCompetition) {
            setActiveCompetition(foundCompetition);
            setTeams(foundCompetition.teams || []);

            // Fetch achievement logs
            // Note: This would need a specific API endpoint for competition logs
          } else if (isMounted) {
            // No active competition - show static leaderboard
            setActiveCompetition(null);
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
    };
  }, [podId]);

  const { agentLeaderboard, teamLeaderboard } = useMemo(() => {
    if (!activeCompetition || podAgents.length === 0) {
      // Create static leaderboard based on agents
      const staticLeaderboard = podAgents.map((agent, idx) => ({
        id: agent.id,
        name: agent.name,
        score: 0,
        rank: idx + 1,
        avatarInitials: agent.avatarInitials,
        avatarBgColor: agent.avatarBgColor,
      }));
      return { agentLeaderboard: staticLeaderboard, teamLeaderboard: [] };
    }

    // Agent calculations
    const agentScores: Record<string, number> = {};
    podAgents.forEach(agent => { agentScores[agent.id] = 0; });
    achievementLogs.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId] += log.points || 0;
      }
    });
    const agentLeaderboardData = podAgents.map(agent => ({
      id: agent.id,
      name: agent.name,
      score: agentScores[agent.id] || 0,
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
          {error}
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
        {teamLeaderboard.length > 0 && (
          <Leaderboard
            title="Team Leaderboard"
            entries={teamLeaderboard}
            isStickyHeader={false}
          />
        )}
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
          {isLoading ? (
            <Skeleton className="h-4 w-64 mt-1.5" />
          ) : (
            <CardDescription>
              {`Showing results for competition: ${activeCompetition?.name || 'No active competition'}`}
            </CardDescription>
          )}
        </CardHeader>
      </Card>
      {renderContent()}
    </div>
  );
}
