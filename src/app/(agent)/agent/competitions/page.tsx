'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Users, Star, Target, User, ArrowRight } from "lucide-react";
import { onSnapshot, doc, getDoc, query, collection, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import type { DailyAchievementLog } from '@/app/(admin)/admin/log-achievements/page';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';

interface Competition {
  id: string;
  name: string;
  startDate?: Timestamp;
  endDate?: Timestamp;
  podIds?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds: string[];
    emoji?: string;
  }>;
}

interface Team {
  id: string;
  name: string;
  agentIds: string[];
  emoji?: string;
}

interface RuleFormData {
  id: string;
  name: string;
  emoji?: string;
  pointValue?: number;
}

interface CompetitionWithRules extends Competition {
  rules: RuleFormData[];
}

const AGENT_COMPETITION_KEY = 'agentCompetitionPage_selectedCompetitionId';

export default function AgentCompetitionsPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionWithRules[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, AppUser[]>>({});
  const [achievementLogs, setAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [allAchievementLogs, setAllAchievementLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch user
  useEffect(() => {
    let mounted = true;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists() && mounted) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
    });
    
    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Fetch competitions for user's pod
  useEffect(() => {
    // Fetch all competitions (remove pod filter for now to debug)
    const compQuery = query(
      collection(db, 'competitions'),
      orderBy('startDate', 'desc')
    );

    const unsubscribe = onSnapshot(compQuery, (snapshot) => {
      const fetchedComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompetitionWithRules));
      setCompetitions(fetchedComps);
      
      // Set default competition - always prefer active competition
      if (fetchedComps.length > 0 && !selectedCompetitionId) {
        const userPodId = currentUser?.podId;
        const filteredComps = userPodId 
          ? fetchedComps.filter(c => c.podIds?.includes(userPodId))
          : fetchedComps;
        const availableComps = filteredComps.length > 0 ? filteredComps : fetchedComps;
        
        const now = new Date();
        
        // First, find currently active competition
        const currentComp = availableComps.find(comp => {
          const start = comp.startDate?.toDate();
          const end = comp.endDate?.toDate();
          return start && end && now >= start && now <= end;
        });
        
        if (currentComp) {
          setSelectedCompetitionId(currentComp.id);
        } else {
          // No active competition - fall back to saved or most recent
          const savedCompId = localStorage.getItem(AGENT_COMPETITION_KEY);
          if (savedCompId && availableComps.some(c => c.id === savedCompId)) {
            setSelectedCompetitionId(savedCompId);
          } else if (availableComps.length > 0) {
            setSelectedCompetitionId(availableComps[0].id);
          }
        }
      }
    });

    return () => unsubscribe();
  }, []); // Run on mount to fetch all competitions

  // Set default competition when competitions load
  useEffect(() => {
    if (competitions.length > 0 && !selectedCompetitionId) {
      const userPodId = currentUser?.podId;
      const filteredComps = userPodId 
        ? competitions.filter(c => c.podIds?.includes(userPodId))
        : competitions;
      const availableComps = filteredComps.length > 0 ? filteredComps : competitions;
      
      const now = new Date();
      
      // First, find currently active competition
      const currentComp = availableComps.find(comp => {
        const start = comp.startDate?.toDate();
        const end = comp.endDate?.toDate();
        return start && end && now >= start && now <= end;
      });
      
      if (currentComp) {
        setSelectedCompetitionId(currentComp.id);
      } else {
        // No active competition - fall back to saved or most recent
        const savedCompId = localStorage.getItem(AGENT_COMPETITION_KEY);
        if (savedCompId && availableComps.some(c => c.id === savedCompId)) {
          setSelectedCompetitionId(savedCompId);
        } else if (availableComps.length > 0) {
          setSelectedCompetitionId(availableComps[0].id);
        }
      }
    }
  }, [competitions, currentUser?.podId, selectedCompetitionId]);

  // Fetch teams from competition document
  useEffect(() => {
    if (!selectedCompetitionId) {
      setTeams([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);

    const compDocRef = doc(db, 'competitions', selectedCompetitionId);
    const unsubscribe = onSnapshot(compDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const compData = docSnap.data() as CompetitionWithRules & { teams?: Team[] };
        setTeams(compData.teams || []);
        setIsLoadingData(false); // Set loading false INSIDE callback
      }
    });

    return () => unsubscribe();
  }, [selectedCompetitionId]);

  // Fetch team members
  useEffect(() => {
    if (teams.length === 0) return;

    const allAgentIds = teams.flatMap(t => t.agentIds);
    if (allAgentIds.length === 0) return;

    const membersMap: Record<string, AppUser[]> = {};
    teams.forEach(team => {
      membersMap[team.id] = [];
    });

    const usersQuery = query(
      collection(db, 'users'),
      where('__name__', 'in', allAgentIds)
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      teams.forEach(team => {
        membersMap[team.id] = team.agentIds
          .map(id => users.find(u => u.id === id))
          .filter(Boolean) as AppUser[];
      });
      setTeamMembers({ ...membersMap });
    });

    return () => unsubscribe();
  }, [teams]);

  // Fetch all achievement logs for the competition (for team scores)
  useEffect(() => {
    if (!selectedCompetitionId) {
      setAllAchievementLogs([]);
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);

    const logsQuery = query(
      collection(db, 'dailyAchievements'),
      where('competitionId', '==', selectedCompetitionId)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog));
      setAllAchievementLogs(logs);
      setIsLoadingData(false); // Set loading false INSIDE callback - this triggers re-render
    });

    return () => unsubscribe();
  }, [selectedCompetitionId]);

  // Fetch current user's achievement logs (for agent's personal score breakdown)
  useEffect(() => {
    if (!selectedCompetitionId || !currentUser) {
      setAchievementLogs([]);
      return;
    }

    // Remove orderBy to avoid index error - just filter by competition and agent
    const logsQuery = query(
      collection(db, 'dailyAchievements'),
      where('competitionId', '==', selectedCompetitionId),
      where('agentId', '==', currentUser.id)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setAchievementLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAchievementLog)));
    });

    return () => unsubscribe();
  }, [selectedCompetitionId, currentUser]);

  const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);

  // Calculate team scores
  const teamScores = useMemo(() => {
    if (!selectedCompetitionId || allAchievementLogs.length === 0 || teams.length === 0) return {};
    
    const scores: Record<string, number> = {};
    teams.forEach(team => {
      let score = 0;
      team.agentIds.forEach(agentId => {
        const agentLogs = allAchievementLogs.filter(log => log.agentId === agentId);
        agentLogs.forEach(log => {
          score += log.points || 0;
        });
      });
      scores[team.id] = score;
    });
    return scores;
  }, [teams, allAchievementLogs, selectedCompetitionId]);

  // Calculate agent leaderboard
  const agentLeaderboard = useMemo(() => {
    if (!selectedCompetition || allAchievementLogs.length === 0 || teams.length === 0) return [];
    
    // Get all agent IDs from teams
    const allAgentIds = teams.flatMap(t => t.agentIds);
    
    // Calculate score for each agent
    const agentScores: Record<string, number> = {};
    allAgentIds.forEach(agentId => {
      agentScores[agentId] = 0;
    });
    
    allAchievementLogs.forEach(log => {
      if (agentScores.hasOwnProperty(log.agentId)) {
        agentScores[log.agentId] += log.points || 0;
      }
    });
    
    // Return sorted agent entries
    return allAgentIds
      .map(agentId => ({
        id: agentId,
        score: agentScores[agentId] || 0,
        teamId: teams.find(t => t.agentIds.includes(agentId))?.id || '',
      }))
      .sort((a, b) => b.score - a.score);
  }, [teams, allAchievementLogs, selectedCompetition]);

  // Calculate agent's score breakdown by rule
  const agentScoreBreakdown = useMemo(() => {
    if (!selectedCompetition?.rules || achievementLogs.length === 0) return [];
    
    const ruleScores: Record<string, number> = {};
    const ruleCounts: Record<string, number> = {};
    selectedCompetition.rules.forEach(rule => {
      ruleScores[rule.id] = 0;
      ruleCounts[rule.id] = 0;
    });

    achievementLogs.forEach(log => {
      if (ruleScores[log.ruleId] !== undefined) {
        ruleScores[log.ruleId] += log.points || 0;
        ruleCounts[log.ruleId] += log.value || 1; // Sum the value field for count
      }
    });

    return selectedCompetition.rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      emoji: rule.emoji || '📊',
      score: ruleScores[rule.id] || 0,
      count: ruleCounts[rule.id] || 0,
    }));
  }, [achievementLogs, selectedCompetition]);

  const totalAgentScore = agentScoreBreakdown.reduce((sum, r) => sum + r.score, 0);

  // Get team leaderboard sorted by score
  const teamLeaderboard = useMemo(() => {
    return teams
      .map(team => ({
        ...team,
        score: teamScores[team.id] || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [teams, teamScores]);

  const handleCompetitionChange = (compId: string) => {
    setSelectedCompetitionId(compId);
    localStorage.setItem(AGENT_COMPETITION_KEY, compId);
  };

  // Filter competitions by user's pod if they have one
  const filteredCompetitions = currentUser?.podId
    ? competitions.filter(c => c.podIds?.includes(currentUser.podId))
    : competitions;

  if (filteredCompetitions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Competitions</h1>
        <Card variant="glass" className="p-6">
          <p className="text-muted-foreground">
            {currentUser?.podId 
              ? "No competitions available for your pod." 
              : "You are not assigned to a pod yet, and no competitions are available."}
          </p>
        </Card>
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Competitions</h1>
        <Card variant="glass" className="p-6">
          <p className="text-muted-foreground">No competitions available for your pod.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competitions</h1>
          <p className="text-muted-foreground">See how your team ranks</p>
        </div>
        <Select value={selectedCompetitionId} onValueChange={handleCompetitionChange}>
          <SelectTrigger className="w-[250px] glass-input">
            <SelectValue placeholder="Select competition" />
          </SelectTrigger>
          <SelectContent>
            {competitions.map(comp => (
              <SelectItem key={comp.id} value={comp.id}>{comp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Competition Info */}
      {selectedCompetition && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {selectedCompetition.name}
            </CardTitle>
            <CardDescription>
              {selectedCompetition.startDate?.toDate && format(selectedCompetition.startDate.toDate(), 'MMM d, yyyy')} - {selectedCompetition.endDate?.toDate && format(selectedCompetition.endDate.toDate(), 'MMM d, yyyy')}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Leaderboard + Stats Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Team Leaderboard - 2/3 width */}
        <Card variant="glass" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Team Leaderboard
            </CardTitle>
            <CardDescription>Rankings by total score</CardDescription>
          </CardHeader>
          <CardContent>
            {teamLeaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No teams yet</p>
            ) : (
              <div className="space-y-3">
                {teamLeaderboard.map((team, index) => (
                  <div key={team.id} className="p-4 rounded-lg bg-glass/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                          index === 1 ? 'bg-gray-400/20 text-gray-400' :
                          index === 2 ? 'bg-orange-400/20 text-orange-400' :
                          'bg-glass text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{team.emoji} {team.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{team.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-11">
                      {teamMembers[team.id]?.map(member => (
                        <div key={member.id} className="flex items-center gap-1 text-xs bg-glass/50 px-2 py-1 rounded-full">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[10px]">
                              {generateInitials(member.name || member.email || 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.name?.split(' ')[0] || member.email?.split('@')[0]}</span>
                          {member.id === currentUser?.id && <Star className="h-3 w-3 text-yellow-500" />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Leaderboard - 1/3 width */}
        <Card variant="glass" className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4" />
              Agent Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {agentLeaderboard.length === 0 ? (
              <p className="text-muted-foreground text-center py-4 text-sm">No agents yet</p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {agentLeaderboard.slice(0, 15).map((agent, index) => {
                  const agentInfo = teamMembers[agent.teamId]?.find(m => m.id === agent.id);
                  const isCurrentUser = agent.id === currentUser?.id;
                  return (
                    <div 
                      key={agent.id} 
                      className={`flex items-center justify-between px-4 py-2 ${
                        isCurrentUser ? 'bg-primary/20' : index % 2 === 0 ? 'bg-glass/20' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                          index === 1 ? 'bg-gray-400/30 text-gray-300' :
                          index === 2 ? 'bg-orange-400/30 text-orange-400' :
                          'bg-glass text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {generateInitials(agentInfo?.name || agentInfo?.email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`text-sm truncate max-w-[120px] ${isCurrentUser ? 'font-medium' : ''}`}>
                          {agentInfo?.name?.split(' ')[0] || agentInfo?.email?.split('@')[0] || 'Unknown'}
                          {isCurrentUser && ' (You)'}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${isCurrentUser ? 'text-primary' : ''}`}>
                        {agent.score.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Your Score Breakdown
        </h2>
        {agentScoreBreakdown.length === 0 ? (
          <Card variant="glass" className="p-6">
            <p className="text-muted-foreground text-center">No achievements logged yet</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {agentScoreBreakdown
              .sort((a, b) => b.score - a.score)
              .map((rule) => (
                <Card key={rule.id} variant="glass" className="p-4 text-center">
                  <span className="text-3xl mb-2 block">{rule.emoji}</span>
                  <p className="font-medium text-sm mb-2 truncate" title={rule.name}>{rule.name}</p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-2xl font-bold text-primary">{rule.count}</span>
                    <span className="text-sm text-muted-foreground">({rule.score} pts)</span>
                  </div>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
