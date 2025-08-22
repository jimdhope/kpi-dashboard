'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, Unsubscribe, doc, getDoc } from 'firebase/firestore';
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
    id: string; // Ensure ID is present
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

  // Effect 1: Fetch all possible competitions for the user's pod
  useEffect(() => {
    if (!agentPodId) return;

    setIsLoading(true);
    const compQuery = query(
        collection(db, 'competitions'),
        where('podIds', 'array-contains', agentPodId),
        orderBy('startDate', 'desc')
    );
    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
        const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithTeams));
        setAllCompetitions(fetchedComps);
        
        // Set default competition if not already set, or if current selection is invalid
        if (!selectedCompetitionId || !fetchedComps.some(c => c.id === selectedCompetitionId)) {
            const savedCompId = localStorage.getItem(TEAM_LEADERBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else if (fetchedComps.length > 0) {
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


  // Effect 2: Fetch competition-specific data (logs, teams, bonuses) when selection changes
  useEffect(() => {
    if (!selectedCompetitionId) {
      setTeams([]);
      setCompetitionLogs([]);
      setBonusLogs([]);
      return;
    }

    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    const fetchCompetitionData = async () => {
        try {
            // Get Team definitions from the competition document
            const compDocRef = doc(db, 'competitions', selectedCompetitionId);
            const compDocSnap = await getDoc(compDocRef);
            if (compDocSnap.exists()) {
                const compData = compDocSnap.data() as CompetitionWithTeams;
                setTeams(compData.teams || []);
            }

            // Listen for all achievement logs for the competition
            const logsQuery = query(collection(db, 'dailyAchievements'), where('competitionId', '==', selectedCompetitionId));
            unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
                setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
            }));

            // Listen for all bonus logs for the competition
            const bonusLogsQuery = query(collection(db, 'teamBonusLogs'), where('competitionId', '==', selectedCompetitionId));
            unsubscribes.push(onSnapshot(bonusLogsQuery, (snapshot) => {
                setBonusLogs(snapshot.docs.map(doc => doc.data() as TeamBonusLog));
                setIsLoading(false); // Mark loading as complete after the final fetch
            }));
        } catch (error) {
            console.error("Error fetching competition data:", error);
            setIsLoading(false);
        }
    };

    fetchCompetitionData();

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId]);


  const teamLeaderboard = useMemo(() => {
    const competition = allCompetitions.find(c => c.id === selectedCompetitionId);
    if (isLoading || !competition || teams.length === 0) {
        return [];
    }
    
    // Filter logs and bonus logs to only include those for teams in the current pod
    const podTeams = teams.filter(team => team.agentIds.some(id => currentUser?.podId && doc(db, 'users', id).parent.id === currentUser.podId));
    const podTeamIds = new Set(podTeams.map(t => t.id));
    
    const podLogs = competitionLogs.filter(log => log.podId === currentUser?.podId);
    const podBonusLogs = bonusLogs.filter(log => log.podId === currentUser?.podId);

    const teamScores = teams.reduce((acc, team) => {
      // Only calculate for teams in the current pod
      if (!podTeamIds.has(team.id)) return acc;

      const teamAgentIds = new Set(team.agentIds);
      const achievementPoints = podLogs
        .filter(log => teamAgentIds.has(log.agentId))
        .reduce((sum, log) => sum + (log.points || 0), 0);
      
      const bonusPoints = podBonusLogs
        .filter(log => log.teamId === team.id)
        .reduce((sum, log) => sum + (log.points || 0), 0);
      
      acc[team.id] = achievementPoints + bonusPoints;
      return acc;
    }, {} as Record<string, number>);

    // Return only the teams that are in the current user's pod
    return podTeams.map(team => ({
      id: team.id,
      name: team.name,
      score: teamScores[team.id] || 0,
      emoji: team.emoji,
      isUser: team.agentIds.includes(currentUser?.id || ''),
    }));
  }, [isLoading, teams, competitionLogs, bonusLogs, currentUser, allCompetitions, selectedCompetitionId]);
  
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
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Leaderboard entries={teamLeaderboard} />
        )}
      </CardContent>
    </Card>
  );
}
