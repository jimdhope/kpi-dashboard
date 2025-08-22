
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
import { Shield, Bug } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

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
  const [podAgents, setPodAgents] = useState<AppUser[]>([]);
  
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
                 setIsLoading(false); 
            }
        } else {
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
    if (!selectedCompetitionId || !agentPodId) {
      setTeams([]);
      setCompetitionLogs([]);
      setBonusLogs([]);
      setPodAgents([]);
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
    
    // Set teams from the already fetched competition data
    setTeams(selectedCompetition.teams || []);

    // Fetch agents for the current user's pod
    const agentsQuery = query(collection(db, 'users'), where('podId', '==', agentPodId));
    unsubscribes.push(onSnapshot(agentsQuery, (snapshot) => {
        setPodAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }));

    // Fetch all logs for the pod within the selected competition's date range
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

    // Fetch bonus logs for the pod within the competition date range
    const bonusLogsQuery = query(
        collection(db, 'teamBonusLogs'),
        where('competitionId', '==', selectedCompetitionId),
        where('podId', '==', agentPodId),
        where('date', '>=', selectedCompetition.startDate),
        where('date', '<=', selectedCompetition.endDate)
    );
    unsubscribes.push(onSnapshot(bonusLogsQuery, (snapshot) => {
        setBonusLogs(snapshot.docs.map(doc => doc.data() as TeamBonusLog));
        setIsLoading(false); 
    }, (error) => {
        console.error("Error fetching bonus logs:", error);
        setIsLoading(false);
    }));

    return () => unsubscribes.forEach(unsub => unsub());
  }, [selectedCompetitionId, agentPodId, allCompetitions]);


 const { teamLeaderboard, debugData } = useMemo(() => {
    if (isLoading || teams.length === 0) {
        return { teamLeaderboard: [], debugData: { agentTotals: [], teamTotals: [] } };
    }

    // 1. Calculate total points for each agent
    const agentScores = podAgents.reduce((acc, agent) => {
        const agentLogs = competitionLogs.filter(log => log.agentId === agent.id);
        const totalPoints = agentLogs.reduce((sum, log) => sum + (log.points || 0), 0);
        acc[agent.id!] = totalPoints;
        return acc;
    }, {} as Record<string, number>);

    // 2. Calculate total points for each team
    const teamScores = teams.reduce((acc, team) => {
        // Sum points from all agents in the team
        const membersPoints = team.agentIds.reduce((sum, agentId) => sum + (agentScores[agentId] || 0), 0);
        
        // Sum bonus points for the team
        const teamBonusPoints = bonusLogs
            .filter(log => log.teamId === team.id)
            .reduce((sum, log) => sum + (log.points || 0), 0);
            
        acc[team.id] = membersPoints + teamBonusPoints;
        return acc;
    }, {} as Record<string, number>);

    const finalLeaderboard = teams.map(team => ({
      id: team.id,
      name: team.name,
      score: teamScores[team.id] || 0,
      emoji: team.emoji,
      isUser: team.agentIds.includes(currentUser?.id || ''),
    }));

    // Prepare data for the debug section
    const debugAgentTotals = podAgents.map(agent => ({
        name: agent.name,
        totalScore: agentScores[agent.id!] || 0,
    })).sort((a,b) => b.totalScore - a.totalScore);

    const debugTeamTotals = teams.map(team => ({
        name: team.name,
        totalScore: teamScores[team.id] || 0,
    })).sort((a,b) => b.totalScore - a.totalScore);

    return {
        teamLeaderboard: finalLeaderboard,
        debugData: {
            agentTotals: debugAgentTotals,
            teamTotals: debugTeamTotals,
        }
    };
}, [isLoading, teams, podAgents, competitionLogs, bonusLogs, currentUser]);
  
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

       {/* Debug Section */}
       <CardContent className="mt-4">
           <Separator />
           <div className="pt-4">
              <h4 className="font-semibold text-sm flex items-center gap-2 mb-2"><Bug className="h-4 w-4"/>Debug Info: Score Calculation</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Agent Scores (Competition)</p>
                   <Table>
                      <TableHeader>
                         <TableRow>
                           <TableHead className="text-xs h-8">Agent</TableHead>
                           <TableHead className="text-right text-xs h-8">Total Points</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                        {debugData.agentTotals.map(agent => (
                            <TableRow key={agent.name}>
                               <TableCell className="text-xs py-1">{agent.name}</TableCell>
                               <TableCell className="text-right text-xs py-1 font-mono">{agent.totalScore}</TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                   </Table>
                </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Final Team Scores (Competition)</p>
                   <Table>
                      <TableHeader>
                         <TableRow>
                           <TableHead className="text-xs h-8">Team</TableHead>
                           <TableHead className="text-right text-xs h-8">Total Points</TableHead>
                         </TableRow>
                      </TableHeader>
                      <TableBody>
                        {debugData.teamTotals.map(team => (
                            <TableRow key={team.name}>
                               <TableCell className="text-xs py-1">{team.name}</TableCell>
                               <TableCell className="text-right text-xs py-1 font-mono">{team.totalScore}</TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                   </Table>
                </div>
              </div>
           </div>
       </CardContent>
    </Card>
  );
}
