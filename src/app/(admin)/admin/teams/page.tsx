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
import { Dialog, DialogTrigger } from "@/components/ui/dialog"; // Import Dialog components
import { Loader2, Users, Shuffle, Save, AlertCircle, Edit } from 'lucide-react'; // Import Edit icon
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import { ManageTeamAgentsDialog } from '@/components/manage-team-agents-dialog'; // Import the new dialog component
import { cn } from '@/lib/utils';

// Team interface remains the same
export interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

// --- Removed DraggableAgent and SortableAgentItem components ---

// Define container ID (still useful for differentiating the source)
const UNASSIGNED_CONTAINER_ID = 'unassigned-agents';

export default function AdminTeamsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [unassignedAgents, setUnassignedAgents] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading for initial data
  const [isLoadingTeams, setIsLoadingTeams] = useState(false); // Specific loading for team data
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // State for the new dialog
  const [isManageTeamAgentsOpen, setIsManageTeamAgentsOpen] = useState(false);
  const [selectedTeamForAgents, setSelectedTeamForAgents] = useState<Team | null>(null);
  const { toast } = useToast();

  const competitionsCollectionRef = collection(db, 'competitions');
  const podsCollectionRef = collection(db, 'pods');
  const usersCollectionRef = collection(db, 'users');

  // --- Removed dnd-kit Setup ---

  // Fetch initial data (competitions, pods, users) - remains largely the same
  useEffect(() => {
    setIsLoading(true); // Start initial loading
    setError(null);
    const unsubscribes: Unsubscribe[] = [];
    let isMounted = true; // Track mount status

    const fetchAllData = async () => {
      try {
        // Fetch Competitions
        const compQuery = query(competitionsCollectionRef, orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
            if (!isMounted) return;
            const fetchedCompetitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
            setCompetitions(fetchedCompetitions);
        }, (err) => { if(isMounted) { console.error("Error fetching competitions:", err); setError("Failed to load competitions."); } }));

        // Fetch Pods
        const podQuery = query(podsCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(podQuery, (snapshot) => {
             if (!isMounted) return;
             const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
             setPods(fetchedPods);
        }, (err) => { if(isMounted) { console.error("Error fetching pods:", err); setError("Failed to load pods."); } }));


        // Fetch Users
        const userQuery = query(usersCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(userQuery, (snapshot) => {
             if (!isMounted) return;
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                 uid: doc.data().uid || doc.id,
                 ...doc.data()
             } as AppUser));
            setUsers(fetchedUsers);
             // Initial data load complete once users are fetched
            setIsLoading(false);
        }, (err) => { if(isMounted) { console.error("Error fetching users:", err); setError("Failed to load users."); setIsLoading(false); } }));


      } catch (err) {
        if(isMounted){
            console.error("Error fetching initial data:", err);
            setError("Failed to load necessary data.");
            setIsLoading(false); // Stop loading even on error
        }
      }
    };

    fetchAllData();

    // Cleanup listeners and mount status
     return () => {
         isMounted = false;
         unsubscribes.forEach(unsub => unsub());
     };
  }, []);

  // Effect to load agents and existing teams when competition and pod are selected - remains largely the same
   useEffect(() => {
        const loadTeamData = async () => {
            if (!selectedCompetitionId || !selectedPodId) {
                 setTeams([]);
                 setUnassignedAgents([]);
                 setIsLoadingTeams(false); // Ensure loading state is reset
                 return;
            }

            // Only set loading if we are actually fetching
            setIsLoadingTeams(true);
            setError(null);

            try {
                // 1. Get the selected pod's agent IDs
                const selectedPod = pods.find(p => p.id === selectedPodId);
                 const podAgentIds = Array.isArray(selectedPod?.agentIds) ? selectedPod.agentIds : [];


                 // 2. Get the full agent user objects from the main 'users' state
                 const podAgents = users.filter(user => user.id && podAgentIds.includes(user.id));

                // 3. Get the selected competition's data, including existing teams
                const compDocRef = doc(db, 'competitions', selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);

                if (compDocSnap.exists()) {
                    const compData = compDocSnap.data() as Competition & { teams?: Team[] }; // Type assertion for teams
                     const existingTeams: Team[] = (compData.teams || []).map((team, index) => ({
                         ...team,
                         id: team.id || `team-${index + 1}-${Date.now()}`,
                         agentIds: Array.isArray(team.agentIds) ? team.agentIds : [],
                     }));

                     // Determine default teams if none exist
                     const teamsToUse = existingTeams.length > 0 ? existingTeams : [
                        { id: `team-1-${Date.now()}`, name: 'Team 1', agentIds: [] },
                        { id: `team-2-${Date.now()}`, name: 'Team 2', agentIds: [] },
                        { id: `team-3-${Date.now()}`, name: 'Team 3', agentIds: [] },
                     ];

                    // 4. Determine unassigned agents
                    const assignedAgentIds = new Set(teamsToUse.flatMap(t => t.agentIds));
                    const currentUnassignedAgents = podAgents.filter(agent => agent.id && !assignedAgentIds.has(agent.id));

                    setTeams(teamsToUse);
                    setUnassignedAgents(currentUnassignedAgents);
                    setError(null); // Clear error on success
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
                setIsLoadingTeams(false); // Always set loading false after attempt
            }
        };

        // Ensure users and pods are loaded before attempting to load team data
         if (users.length > 0 && pods.length > 0) {
            loadTeamData();
         } else if (!isLoading) { // If initial loading is done but no users/pods, set team loading false
             setIsLoadingTeams(false);
             setTeams([]);
             setUnassignedAgents([]);
         }
         // Dependency array: run when selections or base data (users, pods) change
    }, [selectedCompetitionId, selectedPodId, pods, users, isLoading]);


  // --- Memoized Derived Data - remains the same ---
  const selectedCompetition = useMemo(() => competitions.find(c => c.id === selectedCompetitionId), [competitions, selectedCompetitionId]);
  const selectedPod = useMemo(() => {
      // Filter pods based on selected competition FIRST, then find the selected pod
      const competitionPods = pods.filter(p => p.campaignId === selectedCompetition?.campaignId);
      return competitionPods.find(p => p.id === selectedPodId);
  }, [pods, selectedPodId, selectedCompetition]);

  // Filter pods available for the selected competition's campaign
  const availablePods = useMemo(() => {
      if (!selectedCompetition) return [];
      return pods.filter(pod => pod.campaignId === selectedCompetition.campaignId);
  }, [pods, selectedCompetition]);

  // Agents available in the selected pod (memoized)
  const podAgents = useMemo(() => {
    if (!selectedPod || !Array.isArray(selectedPod.agentIds)) return [];
    // Ensure users have IDs before filtering
    return users.filter(user => user.id && selectedPod.agentIds!.includes(user.id));
}, [selectedPod, users]);

// Map of all available agent IDs to their names for quick lookup in the dialog
const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    podAgents.forEach(agent => {
        if (agent.id) {
            map.set(agent.id, agent.name);
        }
    });
    return map;
}, [podAgents]);


  // --- Event Handlers ---
  const handleCompetitionChange = (id: string) => {
    setSelectedCompetitionId(id);
    setSelectedPodId(''); // Reset pod selection when competition changes
    setTeams([]);
    setUnassignedAgents([]);
     setIsLoadingTeams(true); // Set loading while new data is fetched by useEffect
  };

  const handlePodChange = (id: string) => {
    setSelectedPodId(id);
     setIsLoadingTeams(true); // Set loading while new data is fetched by useEffect
     // Data loading is handled by the useEffect hook
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

       // Gather all agents (assigned and unassigned within the current pod context)
       const allRelevantAgents = [...unassignedAgents, ...teams.flatMap(t => t.agentIds).map(id => podAgents.find(a => a.id === id)).filter((a): a is AppUser => !!a)];
       const shuffledAgents = [...allRelevantAgents].sort(() => Math.random() - 0.5);


       // Create new teams structure with reset agentIds
       const newTeams: Team[] = teams.map(team => ({ ...team, agentIds: [] }));

       // Distribute agents round-robin
       shuffledAgents.forEach((agent, index) => {
         if (agent.id) { // Check if agent.id is defined
            newTeams[index % newTeams.length].agentIds.push(agent.id);
         }
       });

       setTeams(newTeams);
       setUnassignedAgents([]); // All agents are assigned
       toast({ title: "Agents Assigned", description: "Agents have been randomly assigned to teams." });
     }, [podAgents, teams, unassignedAgents, toast]); // Include unassignedAgents

   const handleSaveTeams = async () => {
      if (!selectedCompetitionId) {
          toast({ variant: "destructive", title: "Error", description: "No competition selected." });
          return;
      }
      // Removed check for unassigned agents
      // if (unassignedAgents.length > 0) {
      //    toast({ variant: "destructive", title: "Unassigned Agents", description: "Please assign all agents to a team before saving." });
      //    return;
      // }
       if (teams.some(team => !team.name.trim())) {
          toast({ variant: "destructive", title: "Missing Team Name", description: "Please ensure all teams have a name." });
          return;
       }


      setIsSubmitting(true);
      try {
          const compDocRef = doc(db, 'competitions', selectedCompetitionId);
          // Save only the necessary team data
           const teamsToSave = teams.map(({ id, name, agentIds }) => ({ id, name, agentIds }));
          await updateDoc(compDocRef, {
              teams: teamsToSave // Update the 'teams' field in the competition document
          });
          toast({ title: "Teams Saved", description: "Team assignments have been updated for the competition." });
      } catch (err) {
          console.error("Error saving teams:", err);
          toast({ variant: "destructive", title: "Save Error", description: "Could not save team assignments." });
      } finally {
          setIsSubmitting(false);
      }
  };

   // --- New Agent Assignment Logic ---
    const openManageTeamAgentsDialog = (team: Team) => {
        setSelectedTeamForAgents(team);
        setIsManageTeamAgentsOpen(true);
    };

    const handleSaveTeamAgents = (teamId: string, assignedAgentIds: string[]) => {
        if (!selectedTeamForAgents) return;

        const originalAgentIdsInTeam = selectedTeamForAgents.agentIds;
        const originalUnassignedAgentIds = unassignedAgents.map(a => a.id!);

        const agentsToAdd = assignedAgentIds.filter(id => !originalAgentIdsInTeam.includes(id));
        const agentsToRemove = originalAgentIdsInTeam.filter(id => !assignedAgentIds.includes(id));

        // Update the target team
        const updatedTeams = teams.map(team =>
            team.id === teamId ? { ...team, agentIds: assignedAgentIds } : team
        );

        // Update unassigned agents
        // Remove agents that were added to the team
        let updatedUnassignedAgents = unassignedAgents.filter(agent => !agentsToAdd.includes(agent.id!));
        // Add agents that were removed from the team back to unassigned
        agentsToRemove.forEach(removedId => {
            const agentToAddBack = podAgents.find(a => a.id === removedId);
            if (agentToAddBack && !updatedUnassignedAgents.some(a => a.id === removedId)) {
                updatedUnassignedAgents.push(agentToAddBack);
            }
        });

        setTeams(updatedTeams);
        setUnassignedAgents(updatedUnassignedAgents);

        setIsManageTeamAgentsOpen(false); // Close the dialog
        setSelectedTeamForAgents(null);
        toast({ title: "Agents Updated", description: `Team "${selectedTeamForAgents.name}" agent assignments updated.` });
    };

    // Function to get agent object by ID
    const getAgentById = (id: string): AppUser | undefined => users.find(u => u.id === id);

    return (
        // Dialog Provider for the new agent assignment dialog
        <Dialog open={isManageTeamAgentsOpen} onOpenChange={setIsManageTeamAgentsOpen}>
            <div className="space-y-6">
            <Card>
                <CardHeader>
                <CardTitle>Manage Competition Teams</CardTitle>
                <CardDescription>Select a competition and pod, then create/edit teams and assign agents.</CardDescription>
                </CardHeader>
                <CardContent>
                {/* Selections - remains the same */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Competition Select */}
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

                    {/* Pod Select (Filtered) */}
                    <div className="grid gap-2">
                    <Label htmlFor="pod-select">Pod</Label>
                    <Select onValueChange={handlePodChange} value={selectedPodId} disabled={isLoading || isSubmitting || !selectedCompetitionId}>
                        <SelectTrigger id="pod-select">
                        <SelectValue placeholder={!selectedCompetitionId ? "Select competition first" : "Select a pod"} />
                        </SelectTrigger>
                        <SelectContent>
                        {!selectedCompetitionId && <SelectItem value="-" disabled>Select competition first</SelectItem>}
                        {selectedCompetitionId && availablePods.length === 0 && !isLoading && <SelectItem value="-" disabled>No pods in campaign</SelectItem>}
                        {isLoading && selectedCompetitionId && <SelectItem value="-" disabled>Loading pods...</SelectItem>}
                        {availablePods.map(pod => (
                            <SelectItem key={pod.id} value={pod.id}>{pod.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                </div>

                {error && <p className="text-destructive text-center mb-4">{error}</p>}

                {/* Team Management Area */}
                {selectedCompetitionId && selectedPodId && !isLoadingTeams && !isLoading && (
                    <div className="space-y-6">
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                            variant="outline"
                            onClick={handleRandomAssignment}
                            disabled={isSubmitting || teams.length === 0 || podAgents.length === 0}
                            title={ podAgents.length === 0 ? "No agents in pod" : "Randomly assign agents"}
                            >
                                <Shuffle className="mr-2 h-4 w-4" /> Random Assign
                            </Button>
                            {/* Remove disabled check for unassignedAgents */}
                            <Button onClick={handleSaveTeams} disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Teams
                            </Button>
                            {/* Keep the unassigned agents indicator */}
                            {unassignedAgents.length > 0 && (
                                <p className="text-xs text-destructive flex items-center gap-1 w-full justify-end">
                                    <AlertCircle className="h-3 w-3"/> {unassignedAgents.length} agent(s) unassigned.
                                </p>
                            )}
                        </div>

                        {/* Team Columns with List and Edit Button */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* --- Unassigned Agents Column --- */}
                            <Card className="bg-muted/30 flex flex-col">
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
                                                    <Card key={agent.id} className="p-2 text-sm bg-card shadow-sm">
                                                        {agent.name}
                                                    </Card>
                                                ) : null
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </Card>

                            {/* --- Team Columns --- */}
                            {teams.map((team) => (
                                <Card key={team.id} className="flex flex-col">
                                    <CardHeader className="p-4 flex flex-row items-start justify-between gap-2">
                                        <div className='flex-1'>
                                            <Label htmlFor={`team-name-${team.id}`} className="sr-only">Team Name</Label>
                                            <Input
                                                id={`team-name-${team.id}`}
                                                value={team.name}
                                                onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                                                placeholder={`Team Name`}
                                                className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto mb-1"
                                                disabled={isSubmitting}
                                            />
                                            <CardDescription>({team.agentIds.length} Agents)</CardDescription>
                                        </div>
                                        {/* Edit Agents Button - Triggers Dialog */}
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
                                                        <Card key={agentId} className="p-2 text-sm bg-card/80 shadow-sm">
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

                {/* Loading State for Team Data */}
                {(isLoadingTeams || isLoading) && selectedCompetitionId && selectedPodId && (
                    <div className="mt-6 space-y-4">
                        <div className="flex justify-end gap-2">
                            <Skeleton className="h-9 w-36" />
                            <Skeleton className="h-9 w-28" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Skeleton className="h-80 w-full" />
                            <Skeleton className="h-80 w-full" />
                            <Skeleton className="h-80 w-full" />
                            <Skeleton className="h-80 w-full" />
                        </div>
                    </div>
                )}

                {/* Initial prompt */}
                {!selectedCompetitionId && !isLoading && (
                    <p className="text-center text-muted-foreground mt-6">Select a competition to start managing teams.</p>
                )}
                {selectedCompetitionId && !selectedPodId && !isLoading && (
                    <p className="text-center text-muted-foreground mt-6">Select a pod to view agents and teams.</p>
                )}
                </CardContent>
            </Card>
            </div>

            {/* Dialog Content for Managing Team Agents */}
            {selectedTeamForAgents && (
                <ManageTeamAgentsDialog
                    team={selectedTeamForAgents}
                    unassignedAgents={unassignedAgents}
                    agentNameMap={agentNameMap} // Pass the map for displaying names
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
