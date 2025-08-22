
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { DailyAchievementLog, TeamBonusLog } from '@/app/(admin)/admin/log-achievements/page';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Leaderboard } from '@/components/leaderboard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';

interface TeamLeaderboardWidgetProps {
  currentUser: AppUser | null;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface CompetitionWithTeams extends Competition {
    teams?: Team[];
}

const TEAM_LEADERBOARD_COMP_KEY = 'teamLeaderboard_selectedCompId';

export function TeamLeaderboardWidget({ currentUser }: TeamLeaderboardWidgetProps) {
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [allCompetitions, setAllCompetitions] = useState<CompetitionWithTeams[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [competitionLogs, setCompetitionLogs] = useState<DailyAchievementLog[]>([]);
  const [bonusLogs, setBonusLogs] = useState<TeamBonusLog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  
  const agentPodId = currentUser?.podId;

  // Fetch all possible competitions for the user's pod
  useEffect(() => {
    if (!agentPodId) return;
    const compQuery = query(
        collection(db, 'competitions'),
        where('podIds', 'array-contains', agentPodId),
        orderBy('startDate', 'desc')
    );
    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithTeams));
        setAllCompetitions(fetchedComps);
        if (!selectedCompetitionId && fetchedComps.length > 0) {
            const savedCompId = localStorage.getItem(TEAM_LEADERBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else {
                setSelectedCompetitionId(fetchedComps[0].id);
            }
        }
    });
    return () => unsubscribe();
  }, [agentPodId, selectedCompetitionId]);

  // Fetch logs and team data for the selected competition
  useEffect(() => {
    if (!selectedCompetitionId || !agentPodId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    // Set teams from selected competition data
    const competitionData = allCompetitions.find(c => c.id === selectedCompetitionId);
    setTeams(competitionData?.teams?.filter(t => t.agentIds.some(agentId => currentUser?.podId && doc(db, 'users', agentId).parent.id === currentUser.podId)) || []);


    // Fetch logs for the pod within the competition
    const logsQuery = query(
      collection(db, 'dailyAchievements'),
      where('competitionId', '==', selectedCompetitionId),
      where('podId', '==', agentPodId)
    );
    unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
      setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
    }));

    // Fetch bonus logs for the pod within the competition
    const bonusLogsQuery = query(
      collection(db, 'teamBonusLogs'),
      where('competitionId', '==', selectedCompetitionId),
      where('podId', '==', agentPodId)
    );
    unsubscribes.push(onSnapshot(bonusLogsQuery, (snapshot) => {
      setBonusLogs(snapshot.docs.map(doc => doc.data() as TeamBonusLog));
      setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId, agentPodId, allCompetitions, currentUser?.podId]);

  const teamLeaderboard = useMemo(() => {
    if (isLoading || teams.length === 0) return [];
    
    const teamScores = teams.reduce((acc, team) => {
      const teamAgentIds = new Set(team.agentIds);
      const achievementPoints = competitionLogs
        .filter(log => teamAgentIds.has(log.agentId))
        .reduce((sum, log) => sum + (log.points || 0), 0);
      const bonusPoints = bonusLogs
        .filter(log => log.teamId === team.id)
        .reduce((sum, log) => sum + (log.points || 0), 0);
      
      acc[team.id] = achievementPoints + bonusPoints;
      return acc;
    }, {} as Record<string, number>);

    return teams.map(team => ({
      id: team.id,
      name: team.name,
      score: teamScores[team.id] || 0,
      emoji: team.emoji,
      isUser: team.agentIds.includes(currentUser?.id || ''),
    }));
  }, [isLoading, teams, competitionLogs, bonusLogs, currentUser?.id]);
  
  const handleCompetitionChange = (value: string) => {
    setSelectedCompetitionId(value);
    localStorage.setItem(TEAM_LEADERBOARD_COMP_KEY, value);
  };

  const selectedCompetition = allCompetitions.find(c => c.id === selectedCompetitionId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Team Leaderboard
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
        {selectedCompetition && <CardDescription>Team ranking for: {selectedCompetition.name}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Leaderboard entries={teamLeaderboard} />
        )}
      </CardContent>
    </Card>
  );
}
