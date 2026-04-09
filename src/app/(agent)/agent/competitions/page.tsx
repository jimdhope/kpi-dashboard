'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Star, Target } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format } from 'date-fns';
import type { AppUser, CompetitionRecord } from '@/lib/contracts';

const AGENT_COMPETITION_KEY = 'agentCompetitionPage_selectedCompetitionId';

export default function AgentCompetitionsPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [competitions, setCompetitions] = useState<CompetitionRecord[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [achievementLogs, setAchievementLogs] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      }
    }
    fetchSession();
  }, []);

  useEffect(() => {
    async function fetchCompetitions() {
      try {
        const res = await fetch('/api/competitions');
        if (res.ok) {
          const data = await res.json();
          setCompetitions(data.competitions || []);
          
          if (data.competitions?.length > 0 && !selectedCompetitionId) {
            const now = new Date();
            const currentComp = data.competitions.find((comp: any) => {
              const start = comp.startsAt ? new Date(comp.startsAt) : null;
              const end = comp.endsAt ? new Date(comp.endsAt) : null;
              return start && end && now >= start && now <= end;
            });
            
            if (currentComp) {
              setSelectedCompetitionId(currentComp.id);
            } else {
              const savedCompId = localStorage.getItem(AGENT_COMPETITION_KEY);
              if (savedCompId && data.competitions.some((c: any) => c.id === savedCompId)) {
                setSelectedCompetitionId(savedCompId);
              } else {
                setSelectedCompetitionId(data.competitions[0].id);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error fetching competitions:', err);
      }
    }
    fetchCompetitions();
  }, [selectedCompetitionId]);

  useEffect(() => {
    async function fetchAchievements() {
      if (!selectedCompetitionId) {
        setAchievementLogs([]);
        return;
      }
      setIsLoadingData(true);
      try {
        const res = await fetch(`/api/competitions/${selectedCompetitionId}/achievements`);
        if (res.ok) {
          const data = await res.json();
          setAchievementLogs(data.achievements || []);
        }
      } catch (err) {
        console.error('Error fetching achievements:', err);
      }
      setIsLoadingData(false);
    }
    fetchAchievements();
  }, [selectedCompetitionId]);

  const selectedCompetition = competitions.find(c => c.id === selectedCompetitionId);

  // Calculate team scores
  const teamScores = useMemo(() => {
    if (!selectedCompetition || achievementLogs.length === 0) return {};
    const scores: Record<string, number> = {};
    selectedCompetition.teams?.forEach(team => {
      scores[team.id] = 0;
    });
    achievementLogs.forEach(log => {
      const team = selectedCompetition.teams?.find(t => {
        // Simplified - in real implementation would need user-to-team mapping
        return true;
      });
      if (team) {
        scores[team.id] = (scores[team.id] || 0) + (log.points || 0);
      }
    });
    return scores;
  }, [selectedCompetition, achievementLogs]);

  // Calculate agent scores
  const agentScores = useMemo(() => {
    if (achievementLogs.length === 0) return [];
    const scores: Record<string, number> = {};
    achievementLogs.forEach(log => {
      scores[log.agentId] = (scores[log.agentId] || 0) + (log.points || 0);
    });
    return Object.entries(scores)
      .map(([agentId, score]) => ({ agentId, score }))
      .sort((a, b) => b.score - a.score);
  }, [achievementLogs]);

  // Calculate agent's score breakdown by rule
  const agentScoreBreakdown = useMemo(() => {
    if (!selectedCompetition?.rules || achievementLogs.length === 0 || !currentUser) return [];
    const userLogs = achievementLogs.filter(log => log.agentId === currentUser.id);
    
    const ruleScores: Record<string, { count: number; points: number }> = {};
    selectedCompetition.rules.forEach(rule => {
      ruleScores[rule.id] = { count: 0, points: 0 };
    });

    userLogs.forEach(log => {
      if (ruleScores[log.ruleId]) {
        ruleScores[log.ruleId].count += 1;
        ruleScores[log.ruleId].points += log.points || 0;
      }
    });

    return selectedCompetition.rules.map(rule => ({
      id: rule.id,
      name: rule.title,
      score: ruleScores[rule.id]?.points || 0,
      count: ruleScores[rule.id]?.count || 0,
    }));
  }, [achievementLogs, selectedCompetition, currentUser]);

  const totalAgentScore = agentScoreBreakdown.reduce((sum, r) => sum + r.score, 0);

  // Get team leaderboard
  const teamLeaderboard = useMemo(() => {
    if (!selectedCompetition?.teams) return [];
    return selectedCompetition.teams
      .map(team => ({
        ...team,
        score: teamScores[team.id] || 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [selectedCompetition, teamScores]);

  const handleCompetitionChange = (compId: string) => {
    setSelectedCompetitionId(compId);
    localStorage.setItem(AGENT_COMPETITION_KEY, compId);
  };

  if (competitions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Competitions</h1>
        <Card variant="glass" className="p-6">
          <p className="text-muted-foreground">No competitions available.</p>
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

      {selectedCompetition && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              {selectedCompetition.name}
            </CardTitle>
            <CardDescription>
              {selectedCompetition.startsAt && format(new Date(selectedCompetition.startsAt), 'MMM d, yyyy')} - {selectedCompetition.endsAt && format(new Date(selectedCompetition.endsAt), 'MMM d, yyyy')}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="glass" className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Team Leaderboard
            </CardTitle>
            <CardDescription>Rankings by total score</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <Skeleton className="h-48" />
            ) : teamLeaderboard.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">No teams yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamLeaderboard.map((team, index) => (
                  <div key={team.id} className="p-4 rounded-lg bg-glass/30">
                    <div className="flex items-center justify-between">
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
                          <p className="font-medium">{team.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{team.score.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">points</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4" />
              Agent Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingData ? (
              <Skeleton className="h-48" />
            ) : agentScores.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-muted-foreground text-sm">No agents yet</p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                {agentScores.slice(0, 15).map((agent, index) => {
                  const isCurrentUser = agent.agentId === currentUser?.id;
                  return (
                    <div 
                      key={agent.agentId} 
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
                        <span className={`text-sm truncate max-w-[120px] ${isCurrentUser ? 'font-medium' : ''}`}>
                          {isCurrentUser ? 'You' : 'Agent'}
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

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Target className="h-5 w-5" />
          Your Score Breakdown
        </h2>
        {agentScoreBreakdown.length === 0 ? (
          <Card variant="glass" className="p-6">
            <div className="text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No achievements logged yet</p>
              <p className="text-sm text-muted-foreground/60 mt-1 mb-3">Log your daily achievements to earn points</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {agentScoreBreakdown
              .sort((a, b) => b.score - a.score)
              .map((rule) => (
                <Card key={rule.id} variant="glass" className="p-4 text-center">
                  <span className="text-3xl mb-2 block">📊</span>
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
