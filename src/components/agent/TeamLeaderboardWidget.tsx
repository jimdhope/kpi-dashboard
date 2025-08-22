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

  // Effect 1: Fetch all possible competitions for the user's pod
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
        
        if (!selectedCompetitionId || !fetchedComps.some(c => c.id === selectedCompetitionId)) {
            const savedCompId = localStorage.getItem(TEAM_LEADERBOARD_COMP_KEY);
            if (savedCompId && fetchedComps.some(c => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
            } else if (fetchedComps.length > 0) {
                 setSelectedCompetitionId(fetchedComps[0].id);
            } else {
                 setIsLoading(false); // No competitions, stop loading
            }
        } else {
            // This handles the case where competitions update but the selected one is still valid
            setIsLoading(false);
        }
    }, (error) => {
        console.error("Error fetching competitions:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [agentPodId]);


  // Effect 2: Fetch competition-specific data when selection changes
  useEffect(() => {
    if (!selectedCompetitionId) {
      setTeams([]);
      setCompetitionLogs([]);
      setBonusLogs([]);
      setIsLoading(false);
      return () => {}; // Return empty cleanup function
    }

    const selectedCompetition = allCompetitions.find(c => c.id === selectedCompetitionId);

    if (!selectedCompetition) {
        setIsLoading(false);
        return () => {};
    }

    setIsLoading(true);
    const unsubscribes: Unsubscribe[] = [];

    // Set teams immediately from the selected competition data
    setTeams(selectedCompetition.teams || []);

    // Listen for all achievement logs for the competition for the correct date range
    const logsQuery = query(
        collection(db, 'dailyAchievements'),
        where('competitionId', '==', selectedCompetitionId),
        where('date', '>=', selectedCompetition.startDate),
        where('date', '<=', selectedCompetition.endDate)
    );
    unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
        setCompetitionLogs(snapshot.docs.map(doc => doc.data() as DailyAchievementLog));
    }));

    // Listen for all bonus logs for the competition
    const bonusLogsQuery = query(
        collection(db, 'teamBonusLogs'),
        where('competitionId', '==', selectedCompetitionId),
        where('date', '>=', selectedCompetition.startDate),
        where('date', '<=', selectedCompetition.endDate)
    );
    unsubscribes.push(onSnapshot(bonusLogsQuery, (snapshot) => {
        setBonusLogs(snapshot.docs.map(doc => doc.data() as TeamBonusLog));
        setIsLoading(false); // Only set loading to false after the final fetch
    }, (error) => {
        console.error("Error fetching bonus logs:", error);
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId, allCompetitions]); // Depend only on the ID and the list of all comps


  const teamLeaderboard = useMemo(() => {
    const competition = allCompetitions.find(c => c.id === selectedCompetitionId);
    if (isLoading || !competition || teams.length === 0) {
        return [];
    }
    
    const teamScores = teams.reduce((acc, team) => {
      const teamAgentIds = new Set(team.agentIds);
      const achievementPoints = competitionLogs
        .filter(log => teamAgentIds.has(log.agentId))
        .reduce((sum, log) => sum + (log.points || 0), 0);
      
      const teamBonusPoints = bonusLogs
        .filter(log => log.teamId === team.id)
        .reduce((sum, log) => sum + (log.points || 0), 0);
      
      acc[team.id] = achievementPoints + teamBonusPoints;
      return acc;
    }, {} as Record<string, number>);

    return teams.map(team => ({
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
