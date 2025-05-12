
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  updateDoc,
  onSnapshot,
  Unsubscribe,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Users, Shuffle, Save, AlertCircle, Edit, Filter } from 'lucide-react'; // Added Filter
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import { ManageTeamAgentsDialog } from '@/components/manage-team-agents-dialog';
import { cn } from '@/lib/utils';

export interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

const UNASSIGNED_CONTAINER_ID = 'unassigned-agents';

export default function AdminTeamsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [unassignedAgents, setUnassignedAgents] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isManageTeamAgentsOpen, setIsManageTeamAgentsOpen] = useState(false);
  const [selectedTeamForAgents, setSelectedTeamForAgents] = useState<Team | null>(null);
  const { toast } = useToast();

  const competitionsCollectionRef = collection(db, 'competitions');
  const podsCollectionRef = collection(db, 'pods');
  const usersCollectionRef = collection(db, 'users');

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true;

    const fetchAllData = async () => {
      try {
        const compQuery = query(competitionsCollectionRef, orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
            if (!isMounted) return;
            const fetchedCompetitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
            setCompetitions(fetchedCompetitions);
        }, (err) => { if(isMounted) { console.error("Error fetching competitions:", err); setError("Failed to load competitions."); } }));

        const podQuery = query(podsCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(podQuery, (snapshot) => {
             if (!isMounted) return;
             const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
             setPods(fetchedPods);
        }, (err) => { if(isMounted) { console.error("Error fetching pods:", err); setError("Failed to load pods."); } }));

        const userQuery = query(usersCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(userQuery, (snapshot) => {
             if (!isMounted) return;
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                 uid: doc.data().uid || doc.id,
                 ...doc.data()
             } as AppUser));
            setUsers(fetchedUsers);
            setIsLoading(false);
        }, (err) => { if(isMounted) { console.error("Error fetching users:", err); setError("Failed to load users."); setIsLoading(false); } }));

      } catch (err) {
        if(isMounted){
            console.error("Error fetching initial data:", err);
            setError("Failed to load necessary data.");
            setIsLoading(false);
        }
      }
    };

    fetchAllData();

     return () => {
         isMounted = false;
         unsubscribes.forEach(unsub => unsub());
     };
  }, []);

   useEffect(() => {
        const loadTeamData = async () => {
            if (!selectedCompetitionId || !selectedPodId) {
                 setTeams([]);
                 setUnassignedAgents([]);
                 setIsLoadingTeams(false);
                 return;
            }

            setIsLoadingTeams(true);
            setError(null);

            try {
                const selectedPod = pods.find(p => p.id === selectedPodId);
                 const podAgentIds = Array.isArray(selectedPod?.agentIds) ? selectedPod.agentIds : [];
                 const podAgents = users.filter(user => user.id && podAgentIds.includes(user.id));
                const compDocRef = doc(db, 'competitions', selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);

                if (compDocSnap.exists()) {
                    const compData = compDocSnap.data() as Competition & { teams?: Team[] };
                     const existingTeams: Team[] = (compData.teams || []).map((team, index) => ({
                         ...team,
                         id: team.id || `team-${index + 1}-${Date.now()}`,
                         agentIds: Array.isArray(team.agentIds) ? team.agentIds : [],
                     }));

                     const teamsToUse = existingTeams.length > 0 ? existingTeams : [
                        { id: `team-1-${Date.now()}`, name: 'Team 1', agentIds: [] },
                        { id: `team-2-${Date.now()}`, name: 'Team 2', agentIds: [] },
                        { id: `team-3-${Date.now()}`, name: 'Team 3', agentIds: [] },
                     ];

                    const assignedAgentIds = new Set(teamsToUse.flatMap(t => t.agentIds));
                    const currentUnassignedAgents = podAgents.filter(agent => agent.id && !assignedAgentIds.has(agent.id));

                    setTeams(teamsToUse);
                    setUnassignedAgents(currentUnassignedAgents);
                    setError(null);
                } else {
                    setError(`Competition with ID ${selectedCompetitionId} not found.`);
                    setTeams([]);
                    setUnassignedAgents([]);
                }

            } catch (err) {
                console.error("Error loading team data:", err);
                setError("Failed to load team or agent data for the selection.");
                 setTeams([]);
                 setUnassignedAgents([]);
            } finally {
                setIsLoadingTeams(false);
            }
        };

         if (users.length > 0 && pods.length > 0) {
            loadTeamData();
         } else if (!isLoading) {
             setIsLoadingTeams(false);
             setTeams([]);
             setUnassignedAgents([]);
         }
    }, [selectedCompetitionId, selectedPodId, pods, users, isLoading]);

  const selectedCompetition = useMemo(() => competitions.find(c => c.id === selectedCompetitionId), [competitions, selectedCompetitionId]);

  const availablePods = useMemo(() => {
      if (!selectedCompetitionId) return [];
      const competition = competitions.find(c => c.id === selectedCompetitionId);
      if (!competition || !competition.podIds) return [];
      return pods.filter(pod => competition.podIds.includes(pod.id));
  }, [competitions, pods, selectedCompetitionId]);

  const podAgents = useMemo(() => {
    if (!selectedPodId) return [];
    const pod = pods.find(p => p.id === selectedPodId);
    if (!pod || !Array.isArray(pod.agentIds)) return [];
    return users.filter(user => user.id && pod.agentIds!.includes(user.id));
  }, [selectedPodId, pods, users]);

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    podAgents.forEach(agent => {
        if (agent.id) {
            map.set(agent.id, agent.name);
        }
    });
    return map;
  }, [podAgents]);

  const handleCompetitionChange = (id: string) => {
    setSelectedCompetitionId(id);
    setSelectedPodId('');
    setTeams([]);
    setUnassignedAgents([]);
    setIsLoadingTeams(true);
  };

  const handlePodChange = (id: string) => {
    setSelectedPodId(id);
    setIsLoadingTeams(true);
  };

  const handleTeamNameChange = (teamId: string, newName: string) => {
    setTeams(currentTeams =>
      currentTeams.map(team =>
        team.id === teamId ? { ...team, name: newName } : team
      )
    );
  };

   const handleRandomAssignment = useCallback(() => {
       if (podAgents.length === 0 || teams.length === 0) {
         toast({ variant: "destructive", title: "Assignment Error", description: "No agents in the pod or no teams defined." });
         return;
       }
       const allRelevantAgents = [...unassignedAgents, ...teams.flatMap(t => t.agentIds).map(id => podAgents.find(a => a.id === id)).filter((a): a is AppUser => !!a)];
       const shuffledAgents = [...allRelevantAgents].sort(() => Math.random() - 0.5);

       const newTeams: Team[] = teams.map(team => ({ ...team, agentIds: [] }));

       shuffledAgents.forEach((agent, index) => {
         if (agent.id) {
            newTeams[index % newTeams.length].agentIds.push(agent.id);
         }
       });

       setTeams(newTeams);
       setUnassignedAgents([]);
       toast({ title: "Agents Assigned", description: "Agents have been randomly assigned to teams." });
     }, [podAgents, teams, unassignedAgents, toast]);

   const handleSaveTeams = async () => {
      if (!selectedCompetitionId) {
          toast({ variant: "destructive", title: "Error", description: "No competition selected." });
          return;
      }
       if (teams.some(team => !team.name.trim())) {
          toast({ variant: "destructive", title: "Missing Team Name", description: "Please ensure all teams have a name." });
          return;
       }

      setIsSubmitting(true);
      try {
          const compDocRef = doc(db, 'competitions', selectedCompetitionId);
           const teamsToSave = teams.map(({ id, name, agentIds }) => ({ id, name, agentIds }));
          await updateDoc(compDocRef, {
              teams: teamsToSave
          });
          toast({ title: "Teams Saved", description: "Team assignments have been updated for the competition." });
      } catch (err) {
          console.error("Error saving teams:", err);
          toast({ variant: "destructive", title: "Save Error", description: "Could not save team assignments." });
      } finally {
          setIsSubmitting(false);
      }
  };

    const openManageTeamAgentsDialog = (team: Team) => {
        setSelectedTeamForAgents(team);
        setIsManageTeamAgentsOpen(true);
    };

    const handleSaveTeamAgents = (teamId: string, assignedAgentIds: string[]) => {
        if (!selectedTeamForAgents) return;

        const originalAgentIdsInTeam = selectedTeamForAgents.agentIds;

        const agentsToAdd = assignedAgentIds.filter(id => !originalAgentIdsInTeam.includes(id));
        const agentsToRemove = originalAgentIdsInTeam.filter(id => !assignedAgentIds.includes(id));

        const updatedTeams = teams.map(team =>
            team.id === teamId ? { ...team, agentIds: assignedAgentIds } : team
        );

        let updatedUnassignedAgents = unassignedAgents.filter(agent => !agentsToAdd.includes(agent.id!));
        agentsToRemove.forEach(removedId => {
            const agentToAddBack = podAgents.find(a => a.id === removedId);
            if (agentToAddBack && !updatedUnassignedAgents.some(a => a.id === removedId)) {
                updatedUnassignedAgents.push(agentToAddBack);
            }
        });

        setTeams(updatedTeams);
        setUnassignedAgents(updatedUnassignedAgents);

        setIsManageTeamAgentsOpen(false);
        setSelectedTeamForAgents(null);
        toast({ title: "Agents Updated", description: `Team "${selectedTeamForAgents.name}" agent assignments updated.` });
    };

    const getAgentById = (id: string): AppUser | undefined => users.find(u => u.id === id);

    return (
        <Dialog open={isManageTeamAgentsOpen} onOpenChange={setIsManageTeamAgentsOpen}>
            <div className="space-y-6">
            <Card className="frosted-glass">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="grid gap-2">
                            <Label htmlFor="competition-select">Competition</Label>
                            <Select onValueChange={handleCompetitionChange} value={selectedCompetitionId} disabled={isLoading || isSubmitting}>
                                <SelectTrigger id="competition-select">
                                <SelectValue placeholder="Select a competition" />
                                </SelectTrigger>
                                <SelectContent>
                                {competitions.length === 0 && !isLoading && <SelectItem value="-" disabled>No competitions found</SelectItem>}
                                {isLoading && <SelectItem value="-" disabled>Loading...</SelectItem>}
                                {competitions.map(comp => (
                                    <SelectItem key={comp.id} value={comp.id}>
                                    {comp.name} ({comp.startDate ? comp.startDate.toDate().toLocaleDateString() : 'N/A'})
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="pod-select">Pod</Label>
                            <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading || isSubmitting || !selectedCompetitionId}>
                                <SelectTrigger id="pod-select">
                                <SelectValue placeholder={!selectedCompetitionId ? "Select competition first" : "Select a pod"} />
                                </SelectTrigger>
                                <SelectContent>
                                {!selectedCompetitionId && <SelectItem value="-" disabled>Select competition first</SelectItem>}
                                {selectedCompetitionId && availablePods.length === 0 && !isLoading && <SelectItem value="-" disabled>No pods participate in this competition</SelectItem>}
                                {isLoading && selectedCompetitionId && <SelectItem value="-" disabled>Loading pods...</SelectItem>}
                                {availablePods.map(pod => (
                                    <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="frosted-glass">
                <CardHeader>
                <CardTitle>Manage Competition Teams</CardTitle>
                <CardDescription>Create/edit teams and assign agents for the selected competition and pod.</CardDescription>
                </CardHeader>
                <CardContent>
                {error && <p className="text-destructive text-center mb-4">{error}</p>}

                {selectedCompetitionId && selectedPodId && !isLoadingTeams && !isLoading && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                            variant="outline"
                            onClick={handleRandomAssignment}
                            disabled={isSubmitting || teams.length === 0 || podAgents.length === 0}
                            title={ podAgents.length === 0 ? "No agents in pod" : "Randomly assign agents"}
                            >
                                <Shuffle className="mr-2 h-4 w-4" /> Random Assign
                            </Button>
                            <Button onClick={handleSaveTeams} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Teams
                            </Button>
                            {unassignedAgents.length > 0 && (
                                <p className="text-xs text-destructive flex items-center gap-1 w-full justify-end">
                                    <AlertCircle className="h-3 w-3"/> {unassignedAgents.length} agent(s) unassigned.
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="bg-muted/30 flex flex-col frosted-glass">
                                <CardHeader className="p-4">
                                    <CardTitle className="text-base">Unassigned Agents ({unassignedAgents.length})</CardTitle>
                                </CardHeader>
                                <ScrollArea className="flex-grow p-4 border-t min-h-[200px]" id={UNASSIGNED_CONTAINER_ID}>
                                    <div className="space-y-2">
                                        {unassignedAgents.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">All agents assigned.</p>
                                        ) : (
                                            unassignedAgents.map(agent => (
                                                agent.id ? (
                                                    <Card key={agent.id} className="p-2 text-sm bg-card shadow-sm frosted-glass">
                                                        {agent.name}
                                                    </Card>
                                                ) : null
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>

                            {teams.map((team) => (
                                <Card key={team.id} className="flex flex-col frosted-glass">
                                    <CardHeader className="p-4 flex flex-row items-start justify-between gap-2">
                                        <div className='flex-1'>
                                            <Label htmlFor={`team-name-${team.id}`} className="sr-only">Team Name</Label>
                                            <Input
                                                id={`team-name-${team.id}`}
                                                value={team.name}
                                                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                                                placeholder={`Team Name`}
                                                className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto mb-1 bg-transparent"
                                                disabled={isSubmitting}
                                            />
                                            <CardDescription>({team.agentIds.length} Agents)</CardDescription>
                                        </div>
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openManageTeamAgentsDialog(team)}
                                                disabled={isSubmitting}
                                                title={`Edit agents for ${team.name}`}
                                            >
                                                <Edit className="h-4 w-4" />
                                                <span className="sr-only">Edit Agents</span>
                                            </Button>
                                        </DialogTrigger>
                                    </CardHeader>
                                    <ScrollArea className="flex-grow p-4 border-t min-h-[200px]">
                                        <div className="space-y-2">
                                            {team.agentIds.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">No agents assigned</p>
                                            ) : (
                                                team.agentIds.map(agentId => {
                                                    const agent = getAgentById(agentId);
                                                    return agent ? (
                                                        <Card key={agentId} className="p-2 text-sm bg-card/80 shadow-sm frosted-glass">
                                                            {agent.name}
                                                        </Card>
                                                    ) : null;
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {(isLoadingTeams || isLoading) && selectedCompetitionId && selectedPodId && (
                    <div className="mt-6 space-y-4">
                        <div className="flex justify-end gap-2">
                            <Skeleton className="h-9 w-36" />
                            <Skeleton className="h-9 w-28" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Skeleton className="h-80 w-full frosted-glass" />
                            <Skeleton className="h-80 w-full frosted-glass" />
                            <Skeleton className="h-80 w-full frosted-glass" />
                            <Skeleton className="h-80 w-full frosted-glass" />
                        </div>
                    </div>
                )}

                {!selectedCompetitionId && !isLoading && (
                    <p className="text-center text-muted-foreground mt-6">Select a competition to start managing teams.</p>
                )}
                {selectedCompetitionId && !selectedPodId && !isLoading && !isLoadingTeams && (
                    <p className="text-center text-muted-foreground mt-6">Select a pod to view agents and teams.</p>
                )}
                </CardContent>
            </Card>
            </div>

            {selectedTeamForAgents && (
                <ManageTeamAgentsDialog
                    team={selectedTeamForAgents}
                    unassignedAgents={unassignedAgents}
                    agentNameMap={agentNameMap}
                    onSave={handleSaveTeamAgents}
                    onClose={() => {
                        setIsManageTeamAgentsOpen(false);
                        setSelectedTeamForAgents(null);
                    }}
                />
            )}
        </Dialog>
    );
}
