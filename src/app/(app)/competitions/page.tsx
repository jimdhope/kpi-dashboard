'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Target, Medal, ArrowRight, FileText, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Competition {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  podIds?: string[];
  rules?: Array<{
    id: string;
    title: string;
    points: number;
  }>;
  teams?: Array<{
    id: string;
    name: string;
    agentIds?: string[];
    emoji?: string;
  }>;
}

interface Pod {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  podId?: string | null;
  roles: string[];
}

interface Draft {
  id: string;
  name?: string;
  draftData?: any;
  updatedAt?: string;
}

interface Achievement {
  id: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  value: number;
  points: number;
  date: string;
}

const COMPETITION_DASHBOARD_POD_KEY = 'competitionDashboard_selectedPodId';

export default function AdminCompetitionsDashboard() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch drafts on mount
  useEffect(() => {
    async function fetchDrafts() {
      try {
        const res = await fetch('/api/competitions/drafts');
        if (res.ok) {
          const data = await res.json();
          setDrafts(data.drafts || []);
        }
      } catch (error) {
        console.error('Error fetching drafts:', error);
      }
    }
    fetchDrafts();
  }, []);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [compsRes, podsRes, usersRes, achievementsRes] = await Promise.all([
          fetch('/api/competitions'),
          fetch('/api/pods'),
          fetch('/api/users'),
          fetch('/api/achievements'),
        ]);

        if (compsRes.ok) {
          const data = await compsRes.json();
          setCompetitions(data.competitions || []);
          if (data.competitions?.length > 0 && !selectedCompetitionId) {
            setSelectedCompetitionId(data.competitions[0].id);
          }
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }
        if (achievementsRes.ok) {
          const data = await achievementsRes.json();
          setAchievements(data.achievements || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const selectedCompetition = competitions.find((c) => c.id === selectedCompetitionId);
  
  // Use database rules first, fallback to draftData rules (for legacy competitions)
  const competitionRules = useMemo(() => {
    if (!selectedCompetition) return [];
    const dbRules = selectedCompetition.rules || [];
    const draftDataRules = (selectedCompetition as any).draftData?.rules || [];
    return dbRules.length > 0 ? dbRules : draftDataRules;
  }, [selectedCompetition]);
  
  // Use database teams first, fallback to draftData teams
  const competitionTeams = useMemo(() => {
    if (!selectedCompetition) return [];
    const dbTeams = selectedCompetition.teams || [];
    const draftDataTeams = (selectedCompetition as any).draftData?.teams || [];
    return dbTeams.length > 0 ? dbTeams : draftDataTeams;
  }, [selectedCompetition]);
  
  const [selectedPodId, setSelectedPodId] = useState<string>('all');

  useEffect(() => {
    const savedPodId = localStorage.getItem(COMPETITION_DASHBOARD_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  const availablePods = useMemo(() => {
    if (!selectedCompetition) return [];
    return pods.filter((p) => selectedCompetition.podIds?.includes(p.id));
  }, [selectedCompetition, pods]);

  const filteredPods = selectedPodId === 'all' ? availablePods : availablePods.filter((p) => p.id === selectedPodId);
  const filteredPodIds = filteredPods.map((p) => p.id);

  const competitionAchievements = useMemo(() => {
    if (!selectedCompetitionId) return [];
    return achievements.filter((a) => a.competitionId === selectedCompetitionId);
  }, [achievements, selectedCompetitionId]);

const achievementSummary = useMemo(() => {
  if (!competitionRules || competitionAchievements.length === 0) return [];

  return competitionRules.map((rule: any) => {
    const ruleLogs = competitionAchievements.filter((log: any) => {
      // Match by ruleId OR ruleName (for V2 imports)
      const matchesRule = log.ruleId === rule.id || log.ruleName === rule.title;
      const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
      return matchesRule && matchesPod;
    });

    const totalValue = ruleLogs.reduce((sum: number, log: any) => sum + log.value, 0);
    const totalPoints = ruleLogs.reduce((sum: number, log: any) => sum + log.points, 0);

    return { rule, totalValue, totalPoints };
  });
}, [competitionRules, competitionAchievements, filteredPodIds]);

  const podStandings = useMemo(() => {
    if (competitionAchievements.length === 0) return [];

    const podScores: Record<string, { id: string; name: string; score: number }> = {};
    const availablePodIds = new Set(availablePods.map(p => p.id));

    // Initialize pods from competition
    availablePods.forEach((pod) => {
      podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
    });

    // Track achievements with unknown pods
    let unknownPodScore = 0;

    competitionAchievements.forEach((log) => {
      if (availablePodIds.has(log.podId) && podScores[log.podId]) {
        podScores[log.podId].score += log.points;
      } else {
        // Fallback: group achievements with missing podIds into "Unknown Pod"
        unknownPodScore += log.points;
      }
    });

    const standings = Object.values(podScores).sort((a, b) => b.score - a.score);
    
    // Add "Unknown Pod" if there were achievements with missing podIds
    if (unknownPodScore > 0) {
      standings.push({ id: 'unknown', name: 'Unknown Pod', score: unknownPodScore });
    }

    return standings;
  }, [competitionAchievements, availablePods]);

const teamStandings = useMemo(() => {
    const teams = competitionTeams;
    const teamScores: Record<string, { id: string; name: string; score: number; emoji?: string }> = {};

    // Initialize teams
    teams.forEach((team: any) => {
      teamScores[team.id] = { id: team.id, name: team.name, emoji: team.emoji, score: 0 };
    });

    // Calculate scores from achievements by linking agents to teams
    // agentIds now store database IDs (after migration)
    const unassignedScore = { id: 'unassigned', name: 'Unassigned', score: 0 };
    competitionAchievements.forEach((log: any) => {
      const teamWithAgent = teams.find((team: any) => 
        team.agentIds && team.agentIds.includes(log.agentId)
      );
      if (teamWithAgent && teamScores[teamWithAgent.id]) {
        teamScores[teamWithAgent.id].score += log.points;
      } else {
        // Agent not on any team - add to unassigned
        unassignedScore.score += log.points;
      }
    });

    const standings = Object.values(teamScores).sort((a, b) => b.score - a.score);
    
    // Add "Unassigned" if there were agents not on any team
    if (unassignedScore.score > 0) {
      standings.push(unassignedScore);
    }

    return standings;
  }, [competitionTeams, competitionAchievements]);

  const agentStandings = useMemo(() => {
    const agentScores: Record<string, { id: string; name: string; score: number }> = {};

    competitionAchievements.forEach((log) => {
      const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
      if (!matchesPod) return;

      if (!agentScores[log.agentId]) {
        const user = users.find((u) => u.id === log.agentId);
        agentScores[log.agentId] = {
          id: log.agentId,
          name: user?.name || 'Unknown',
          score: 0,
        };
      }
      agentScores[log.agentId].score += log.points;
    });

    return Object.values(agentScores).sort((a, b) => b.score - a.score);
  }, [competitionAchievements, users, filteredPodIds]);

  const handleCompetitionChange = (value: string) => {
    setSelectedCompetitionId(value);
  };

  const handlePodChange = (value: string) => {
    setSelectedPodId(value);
    if (value === 'all') {
      localStorage.removeItem(COMPETITION_DASHBOARD_POD_KEY);
    } else {
      localStorage.setItem(COMPETITION_DASHBOARD_POD_KEY, value);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/competitions/drafts/${draftId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDrafts(drafts.filter(d => d.id !== draftId));
        toast({ title: 'Draft Deleted', description: 'The draft has been removed.' });
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete draft.' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (competitions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Competition Dashboard</h1>
            <p className="text-muted-foreground">Select a competition to view its standings</p>
          </div>
        </div>
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">No Competitions Yet</h2>
          <p className="text-muted-foreground mb-4">Create a competition to get started.</p>
          <Button asChild>
            <Link href="/competitions/manage/wizard">Create Competition</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Competition Dashboard</h1>
          <p className="text-muted-foreground">Select a competition to view its standings</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Drafts Toggle Button */}
          {drafts.length > 0 && (
            <Button
              variant={showDrafts ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowDrafts(!showDrafts)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              My Drafts
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-xs font-medium">
                {drafts.length}
              </span>
            </Button>
          )}
          <Select value={selectedCompetitionId} onValueChange={handleCompetitionChange}>
            <SelectTrigger className="w-[200px] md:w-[250px]">
              <SelectValue placeholder="Select competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPodId} onValueChange={handlePodChange}>
            <SelectTrigger className="w-[150px] lg:w-[200px]">
              <SelectValue placeholder="Filter by pod" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pods</SelectItem>
              {availablePods.map((pod) => (
                <SelectItem key={pod.id} value={pod.id}>
                  {pod.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drafts Section */}
      {showDrafts && drafts.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Saved Drafts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {draft.name || draft.draftData?.name || 'Untitled Draft'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {draft.updatedAt 
                          ? format(new Date(draft.updatedAt), 'MMM d, h:mm a')
                          : 'Recently'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <Link href={`/competitions/manage/wizard?draft=${draft.id}`}>
                        <ArrowRight className="h-4 w-4" aria-label="Continue draft" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteDraft(draft.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-label="Delete draft" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCompetition && (
        <>
          <div className="text-sm text-muted-foreground">
            {selectedCompetition.startsAt && format(new Date(selectedCompetition.startsAt), 'MMM d')} -{' '}
            {selectedCompetition.endsAt && format(new Date(selectedCompetition.endsAt), 'MMM d, yyyy')}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {achievementSummary.map(({ rule, totalValue, totalPoints }: { rule: any; totalValue: number; totalPoints: number }) => (
              <Card key={rule.id} className="frosted-glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="truncate">{rule.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{totalPoints.toLocaleString()} points</p>
                </CardContent>
              </Card>
            ))}
            {achievementSummary.length === 0 && (
              <Card className="col-span-full frosted-glass">
                <CardContent className="py-8 text-center text-muted-foreground">
                  No achievements logged yet
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="frosted-glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Pod Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {podStandings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data</p>
                ) : (
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Pod</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {podStandings.map((pod, index) => (
                          <TableRow key={pod.id}>
                            <TableCell className="font-bold">
                              {index < 3 ? (
                                <Medal className={`h-5 w-5 ${
                                  index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                }`} />
                              ) : (
                                index + 1
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{pod.name}</TableCell>
                            <TableCell className="text-right font-bold">{pod.score.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="frosted-glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  Team Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teamStandings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No teams configured</p>
                ) : (
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamStandings.map((team, index) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-bold">
                              {index < 3 ? (
                                <Medal className={`h-5 w-5 ${
                                  index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                }`} />
                              ) : (
                                index + 1
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{team.name}</TableCell>
                            <TableCell className="text-right font-bold">{team.score.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="frosted-glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  Agent Standings
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agentStandings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No data</p>
                ) : (
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead className="text-right">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agentStandings.slice(0, 20).map((agent, index) => (
                          <TableRow key={agent.id}>
                            <TableCell className="font-bold">
                              {index < 3 ? (
                                <Medal className={`h-5 w-5 ${
                                  index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                }`} />
                              ) : (
                                index + 1
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            <TableCell className="text-right font-bold">{agent.score.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
