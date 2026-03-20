'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Target, Medal, FileText, Clock, Trash2, ArrowRight } from 'lucide-react';
import { Skeleton as SkeletonComponent } from '@/components/ui/skeleton';
import type { AppUser } from '@/services/user';
import { format } from 'date-fns';
import { subscribeToUserCompetitionDrafts, deleteCompetitionDraft } from '@/services/competition-drafts';
import type { CompetitionDraft } from '@/models/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

interface Pod {
  id: string;
  name: string;
}

interface DailyAchievementLog {
  id?: string;
  agentId: string;
  podId: string;
  competitionId: string;
  ruleId: string;
  date: Timestamp;
  value: number;
  points?: number;
}

const COMPETITION_DASHBOARD_POD_KEY = 'competitionDashboard_selectedPodId';

export default function AdminCompetitionsDashboard() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<DailyAchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [drafts, setDrafts] = useState<CompetitionDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const fetchCompetitions = () => {
      const compsQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
      unsubscribes.push(
        onSnapshot(compsQuery, (snapshot) => {
          const comps = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Competition));
          setCompetitions(comps);
          
          if (comps.length > 0 && !selectedCompetitionId) {
            const latestComp = comps[0];
            setSelectedCompetitionId(latestComp.id);
          }
          setIsLoading(false);
        })
      );
    };

    const fetchPods = () => {
      const podsQuery = query(collection(db, 'pods'), orderBy('name'));
      unsubscribes.push(
        onSnapshot(podsQuery, (snapshot) => {
          setPods(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Pod)));
        })
      );
    };

    const fetchUsers = () => {
      const usersQuery = query(collection(db, 'users'), orderBy('name'));
      unsubscribes.push(
        onSnapshot(usersQuery, (snapshot) => {
          setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
        })
      );
    };

    // Subscribe to user's competition drafts
    const currentUser = auth.currentUser;
    if (currentUser) {
      const draftsUnsubscribe = subscribeToUserCompetitionDrafts(currentUser.uid, (userDrafts) => {
        setDrafts(userDrafts);
      });
      unsubscribes.push(draftsUnsubscribe);
    }

    fetchCompetitions();
    fetchPods();
    fetchUsers();

    return () => unsubscribes.forEach((unsub) => unsub());
  }, [selectedCompetitionId]);

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await deleteCompetitionDraft(draftId);
      toast({ title: 'Draft Deleted', description: 'The draft has been removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete draft.' });
    }
  };

  useEffect(() => {
    if (!selectedCompetitionId) return;

    const fetchCompetitionDetails = async () => {
      try {
        const compDoc = await getDoc(doc(db, 'competitions', selectedCompetitionId));
        if (compDoc.exists()) {
          setCompetition({ id: compDoc.id, ...compDoc.data() } as Competition);
        }
      } catch (error) {
        console.error('Error fetching competition:', error);
      }
    };

    const logsQuery = query(
      collection(db, 'dailyAchievements'),
      where('competitionId', '==', selectedCompetitionId)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DailyAchievementLog)));
    });

    fetchCompetitionDetails();

    return () => unsubscribe();
  }, [selectedCompetitionId]);

  const [selectedPodId, setSelectedPodId] = useState<string>('all');

  useEffect(() => {
    const savedPodId = localStorage.getItem(COMPETITION_DASHBOARD_POD_KEY);
    if (savedPodId) setSelectedPodId(savedPodId);
  }, []);

  const availablePods = useMemo(() => {
    if (!competition) return [];
    return pods.filter((p) => competition.podIds?.includes(p.id));
  }, [competition, pods]);

  const currentUser = auth.currentUser;

  const filteredPods = selectedPodId === 'all' ? availablePods : availablePods.filter((p) => p.id === selectedPodId);
  const filteredPodIds = filteredPods.map((p) => p.id);

  const achievementSummary = useMemo(() => {
    if (!competition?.rules || logs.length === 0) return [];

    return competition.rules.map((rule) => {
      const ruleLogs = logs.filter((log) => {
        const matchesRule = log.ruleId === rule.id;
        const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
        return matchesRule && matchesPod;
      });

      const totalValue = ruleLogs.reduce((sum, log) => sum + (log.value || 0), 0);
      const totalPoints = ruleLogs.reduce((sum, log) => sum + (log.points || 0), 0);

      return {
        rule,
        totalValue,
        totalPoints,
      };
    });
  }, [competition, logs, filteredPodIds]);

  const podStandings = useMemo(() => {
    if (logs.length === 0) return [];

    const podScores: Record<string, { id: string; name: string; score: number }> = {};

    availablePods.forEach((pod) => {
      podScores[pod.id] = { id: pod.id, name: pod.name, score: 0 };
    });

    logs.forEach((log) => {
      if (podScores[log.podId]) {
        podScores[log.podId].score += log.points || 0;
      }
    });

    return Object.values(podScores).sort((a, b) => b.score - a.score);
  }, [logs, availablePods]);

  const teamStandings = useMemo(() => {
    const teams = competition?.teams || [];
    const teamScores: Record<string, { id: string; name: string; emoji?: string; score: number }> = {};

    teams.forEach((team) => {
      teamScores[team.id] = { id: team.id, name: team.name, emoji: team.emoji, score: 0 };
    });

    logs.forEach((log) => {
      const pod = availablePods.find((p) => p.id === log.podId);
      if (!pod) return;

      const matchingTeam = teams.find((team) => team.agentIds?.includes(log.agentId));
      if (matchingTeam && teamScores[matchingTeam.id]) {
        teamScores[matchingTeam.id].score += log.points || 0;
      }
    });

    return Object.values(teamScores).sort((a, b) => b.score - a.score);
  }, [logs, competition, availablePods]);

  const agentStandings = useMemo(() => {
    const agentScores: Record<string, { id: string; name: string; score: number; teamId?: string }> = {};

    logs.forEach((log) => {
      const matchesPod = filteredPodIds.length === 0 || filteredPodIds.includes(log.podId);
      if (!matchesPod) return;

      if (!agentScores[log.agentId]) {
        const user = users.find((u) => u.id === log.agentId);
        const teams = competition?.teams || [];
        const agentTeam = teams.find((t) => t.agentIds?.includes(log.agentId));
        agentScores[log.agentId] = {
          id: log.agentId,
          name: user?.name || 'Unknown',
          score: 0,
          teamId: agentTeam?.id,
        };
      }
      agentScores[log.agentId].score += log.points || 0;
    });

    return Object.values(agentScores).sort((a, b) => b.score - a.score);
  }, [logs, users, competition, filteredPodIds]);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-64" />
        </div>
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
            <a href="/admin/competitions">Create Competition</a>
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
          <div className="hidden sm:block">
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
          </div>
          <div className="hidden md:block">
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
      </div>

      {/* Drafts Section */}
      {showDrafts && drafts.length > 0 && (
        <Card className="frosted-glass border-primary/30">
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
                        {draft.name || 'Untitled Draft'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {draft.lastSavedAt?.toDate?.() 
                          ? format(draft.lastSavedAt.toDate(), 'MMM d, h:mm a')
                          : 'Recently'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <Link href={`/admin/competitions/manage/wizard?draft=${draft.id}`}>
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

      {competition && (
        <>
          <div className="text-sm text-muted-foreground">
            {competition.startDate?.toDate && format(competition.startDate.toDate(), 'MMM d')} -{' '}
            {competition.endDate?.toDate && format(competition.endDate.toDate(), 'MMM d, yyyy')}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {achievementSummary.map(({ rule, totalValue, totalPoints }) => (
              <Card key={rule.id} className="frosted-glass">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="text-xl">{rule.emoji || '📋'}</span>
                    <span className="truncate">{rule.name}</span>
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
            {/* Pod Standings - Responsive Card/Table */}
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
                  <>
                    {/* Desktop Table */}
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
                                {index + 1 <= 3 ? (
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
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2">
                      {podStandings.map((pod, index) => (
                        <div key={pod.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              index === 0 && 'bg-yellow-400/30 text-yellow-400',
                              index === 1 && 'bg-gray-400/30 text-gray-300',
                              index === 2 && 'bg-orange-400/30 text-orange-400',
                              index > 2 && 'bg-muted text-muted-foreground'
                            )}>
                              {index + 1 <= 3 ? (
                                <Medal className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <span className="font-medium text-sm">{pod.name}</span>
                          </div>
                          <span className="font-bold text-primary">{pod.score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Team Standings - Responsive Card/Table */}
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
                  <>
                    {/* Desktop Table */}
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
                                {index + 1 <= 3 ? (
                                  <Medal className={`h-5 w-5 ${
                                    index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                  }`} />
                                ) : (
                                  index + 1
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {team.emoji} {team.name}
                              </TableCell>
                              <TableCell className="text-right font-bold">{team.score.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2">
                      {teamStandings.map((team, index) => (
                        <div key={team.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              index === 0 && 'bg-yellow-400/30 text-yellow-400',
                              index === 1 && 'bg-gray-400/30 text-gray-300',
                              index === 2 && 'bg-orange-400/30 text-orange-400',
                              index > 2 && 'bg-muted text-muted-foreground'
                            )}>
                              {index + 1 <= 3 ? (
                                <Medal className="h-4 w-4" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <span className="text-lg">{team.emoji}</span>
                            <span className="font-medium text-sm">{team.name}</span>
                          </div>
                          <span className="font-bold text-primary">{team.score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Agent Standings - Responsive Card/Table */}
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
                  <>
                    {/* Desktop Table */}
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
                          {agentStandings.slice(0, 20).map((agent, index) => {
                            const isCurrentUser = agent.id === currentUser?.uid;
                            return (
                              <TableRow key={agent.id} className={isCurrentUser ? 'bg-primary/10' : ''}>
                                <TableCell className="font-bold">
                                  {index + 1 <= 3 ? (
                                    <Medal className={`h-5 w-5 ${
                                      index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'
                                    }`} />
                                  ) : (
                                    index + 1
                                  )}
                                </TableCell>
                                <TableCell className={`font-medium ${isCurrentUser ? 'text-primary' : ''}`}>
                                  {isCurrentUser ? 'You' : agent.name}
                                </TableCell>
                                <TableCell className={`text-right font-bold ${isCurrentUser ? 'text-primary' : ''}`}>
                                  {agent.score.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2 max-h-[300px] overflow-y-auto">
                      {agentStandings.slice(0, 20).map((agent, index) => {
                        const isCurrentUser = agent.id === currentUser?.uid;
                        return (
                          <div 
                            key={agent.id} 
                            className={cn(
                              "flex items-center justify-between p-2 rounded-lg",
                              isCurrentUser ? 'bg-primary/10' : 'bg-muted/30'
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                index === 0 && 'bg-yellow-400/30 text-yellow-400',
                                index === 1 && 'bg-gray-400/30 text-gray-300',
                                index === 2 && 'bg-orange-400/30 text-orange-400',
                                index > 2 && 'bg-muted text-muted-foreground'
                              )}>
                                {index + 1 <= 3 ? (
                                  <Medal className="h-4 w-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>
                              <span className={cn("font-medium text-sm truncate", isCurrentUser && 'text-primary')}>
                                {isCurrentUser ? 'You' : agent.name}
                              </span>
                            </div>
                            <span className={cn("font-bold text-sm shrink-0 ml-2", isCurrentUser ? 'text-primary' : 'text-primary')}>
                              {agent.score.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
