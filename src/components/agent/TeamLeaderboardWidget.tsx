
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, doc, getDoc, Timestamp } from 'firebase/firestore';
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
    id: string;
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

  // Effect 1: Fetch all possible competitions for the user's pod to populate the dropdown
  useEffect(() => {
    if (!agentPodId) {
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
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
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching competitions:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [agentPodId]);


  // Effect 2: Fetch competition-specific data (logs, bonuses, teams) when selection changes
  useEffect(() => {
    if (!selectedCompetitionId || !agentPodId) {
      setTeams([]);
      setCompetitionLogs([]);
      setBonusLogs([]);
      return;
    }

    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    const fetchCompetitionData = async () => {
        try {
            const compDocRef = doc(db, 'competitions', selectedCompetitionId);
            const compDocSnap = await getDoc(compDocRef);

            if (!compDocSnap.exists()) {
                console.error("Selected competition not found");
                setIsLoading(false);
                return;
            }

            const selectedCompetition = { id: compDocSnap.id, ...compDocSnap.data() } as CompetitionWithTeams;
            setTeams(selectedCompetition.teams || []);

            // ** THE FIX: Correctly query with the full date range **
            const logsQuery = query(
                collection(db, 'dailyAchievements'),
                where('competitionId', '==', selectedCompetitionId),
                where('podId', '==', agentPodId),
                where('date', '>=', selectedCompetition.startDate),
                where('date', '<=', selectedCompetition.endDate)
            );
            unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
                setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
            }));

            const bonusLogsQuery = query(
                collection(db, 'teamBonusLogs'),
                where('competitionId', '==', selectedCompetitionId),
                where('podId', '==', agentPodId),
                where('date', '>=', selectedCompetition.startDate),
                where('date', '<=', selectedCompetition.endDate)
            );
            unsubscribes.push(onSnapshot(bonusLogsQuery, (snapshot) => {
                setBonusLogs(snapshot.docs.map(doc => doc.data() as TeamBonusLog));
            }));

        } catch (error) {
            console.error("Error fetching competition data:", error);
        } finally {
            // This might flicker, but it's safer to ensure it's always set
             setTimeout(() => setIsLoading(false), 500); // Small delay to allow queries to return
        }
    };

    fetchCompetitionData();
    
    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId, agentPodId]);


 const teamLeaderboard = useMemo(() => {
    if (teams.length === 0) {
        return [];
    }

    const teamScores: Record<string, number> = {};

    teams.forEach(team => {
        teamScores[team.id] = 0;
    });

    competitionLogs.forEach(log => {
        const agentTeam = teams.find(team => team.agentIds?.includes(log.agentId));
        if (agentTeam) {
            teamScores[agentTeam.id] += log.points || 0;
        }
    });

    bonusLogs.forEach(log => {
        if (teamScores.hasOwnProperty(log.teamId)) {
            teamScores[log.teamId] += log.points || 0;
        }
    });

    return teams.map(team => ({
      id: team.id,
      name: team.name,
      score: teamScores[team.id] || 0,
      emoji: team.emoji,
      isUser: team.agentIds.includes(currentUser?.id || ''),
    }));
}, [teams, competitionLogs, bonusLogs, currentUser]);
  
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
            disabled={allCompetitions.length === 0 || isLoading}
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
            <Skeleton className="h-8 w-full" />
          </div>
        ) : teamLeaderboard.length === 0 ? (
           <p className="text-muted-foreground text-sm text-center py-4">No team data available for this competition.</p>
        ) : (
          <Leaderboard entries={teamLeaderboard} />
        )}
      </CardContent>
    </Card>
  );
}
