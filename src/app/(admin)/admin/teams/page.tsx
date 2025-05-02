'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Users, Shuffle, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';

interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

export default function AdminTeamsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('');
  const [selectedPodId, setSelectedPodId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [unassignedAgents, setUnassignedAgents] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const competitionsCollectionRef = collection(db, 'competitions');
  const podsCollectionRef = collection(db, 'pods');
  const usersCollectionRef = collection(db, 'users');

  // Fetch initial data (competitions, pods, users)
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const unsubscribes: Unsubscribe[] = [];

    const fetchAllData = async () => {
      try {
        // Fetch Competitions
        const compQuery = query(competitionsCollectionRef, orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(compQuery, (snapshot) => {
          const fetchedCompetitions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition));
          setCompetitions(fetchedCompetitions);
        }, (err) => { console.error("Error fetching competitions:", err); setError("Failed to load competitions."); }));

        // Fetch Pods
        const podQuery = query(podsCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(podQuery, (snapshot) => {
          const fetchedPods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod));
          setPods(fetchedPods);
        }, (err) => { console.error("Error fetching pods:", err); setError("Failed to load pods."); }));


        // Fetch Users
        const userQuery = query(usersCollectionRef, orderBy('name'));
        unsubscribes.push(onSnapshot(userQuery, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                 uid: doc.data().uid || doc.id,
                 ...doc.data()
             } as AppUser));
            setUsers(fetchedUsers);
        }, (err) => { console.error("Error fetching users:", err); setError("Failed to load users."); }));


      } catch (err) {
        console.error("Error fetching initial data:", err);
        setError("Failed to load necessary data.");
      } finally {
         // Consider loading complete when all initial fetches/listeners are setup
         // This might need adjustment depending on how critical each dataset is initially
        setIsLoading(false);
      }
    };

    fetchAllData();

    // Cleanup listeners
    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  // Effect to load agents and existing teams when competition and pod are selected
   useEffect(() => {
        const loadTeamData = async () => {
            if (!selectedCompetitionId || !selectedPodId) {
                 setTeams([]);
                 setUnassignedAgents([]);
                 return;
            }

            setIsLoading(true); // Indicate loading team/agent data
            setError(null);

            try {
                // 1. Get the selected pod's agent IDs
                const selectedPod = pods.find(p => p.id === selectedPodId);
                const podAgentIds = selectedPod?.agentIds || [];

                // 2. Get the full agent user objects
                 const podAgents = users.filter(user => podAgentIds.includes(user.id!));


                // 3. Get the selected competition's data, including existing teams
                const compDocRef = doc(db, 'competitions', selectedCompetitionId);
                const compDocSnap = await getDoc(compDocRef);

                if (compDocSnap.exists()) {
                    const compData = compDocSnap.data() as Competition & { teams?: Team[] }; // Type assertion for teams
                    const existingTeams: Team[] = compData.teams || [
                        { id: 'team-1', name: 'Team 1', agentIds: [] },
                        { id: 'team-2', name: 'Team 2', agentIds: [] },
                        { id: 'team-3', name: 'Team 3', agentIds: [] },
                     ]; // Default to 3 empty teams if none exist


                    // 4. Determine unassigned agents
                    const assignedAgentIds = new Set(existingTeams.flatMap(t => t.agentIds));
                    const currentUnassignedAgents = podAgents.filter(agent => !assignedAgentIds.has(agent.id!));

                     // Ensure teams have IDs
                     const teamsWithIds = existingTeams.map((team, index) => ({
                         ...team,
                         id: team.id || `team-${index + 1}-${Date.now()}` // Generate ID if missing
                     }));


                    setTeams(teamsWithIds);
                    setUnassignedAgents(currentUnassignedAgents);
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
                setIsLoading(false);
            }
        };

        loadTeamData();
    }, [selectedCompetitionId, selectedPodId, pods, users]); // Rerun when selections or base data change

  // --- Memoized Derived Data ---
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


  // --- Event Handlers ---
  const handleCompetitionChange = (id: string) => {
    setSelectedCompetitionId(id);
    setSelectedPodId(''); // Reset pod selection when competition changes
    setTeams([]);
    setUnassignedAgents([]);
  };

  const handlePodChange = (id: string) => {
    setSelectedPodId(id);
     // Data loading is handled by the useEffect hook
  };

  const handleTeamNameChange = (teamId: string, newName: string) => {
    setTeams(currentTeams =>
      currentTeams.map(team =>
        team.id === teamId ? { ...team, name: newName } : team
      )
    );
  };

   const handleRandomAssignment = () => {
     if (!selectedPod) return;

     const podAgents = users.filter(user => selectedPod.agentIds?.includes(user.id!));
     if (podAgents.length === 0 || teams.length === 0) {
       toast({ variant: "destructive", title: "Assignment Error", description: "No agents in the pod or no teams defined." });
       return;
     }

     // Shuffle agents randomly
     const shuffledAgents = [...podAgents].sort(() => Math.random() - 0.5);

     // Create new teams structure with reset agentIds
     const newTeams: Team[] = teams.map(team => ({ ...team, agentIds: [] }));

     // Distribute agents round-robin
     shuffledAgents.forEach((agent, index) => {
       newTeams[index % newTeams.length].agentIds.push(agent.id!);
     });

     setTeams(newTeams);
     setUnassignedAgents([]); // All agents are assigned
     toast({ title: "Agents Assigned", description: "Agents have been randomly assigned to teams." });
   };

   const handleSaveTeams = async () => {
      if (!selectedCompetitionId) {
          toast({ variant: "destructive", title: "Error", description: "No competition selected." });
          return;
      }
      if (unassignedAgents.length > 0) {
         toast({ variant: "destructive", title: "Unassigned Agents", description: "Please assign all agents to a team before saving." });
         return;
      }
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

  // --- Drag and Drop Placeholder ---
  // TODO: Implement drag and drop functionality
  const handleDragEnd = (result: any) => {
      console.log("Drag ended:", result);
       toast({ title: "Drag & Drop", description: "Drag and drop functionality is not yet implemented." });
      // Placeholder for react-beautiful-dnd or dnd-kit logic
      // - Check if destination is valid
      // - Find the dragged agent
      // - Find source and destination columns (unassigned or team)
      // - Update state (unassignedAgents and teams arrays)
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Competition Teams</CardTitle>
          <CardDescription>Select a competition and pod, then create teams and assign agents.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Selections */}
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

           {/* Team Management Area (Conditional Render) */}
           {selectedCompetitionId && selectedPodId && !isLoading && (
              <div className="space-y-6">
                   {/* Action Buttons */}
                 <div className="flex flex-wrap gap-2 justify-end">
                     <Button
                       variant="outline"
                       onClick={handleRandomAssignment}
                       disabled={isSubmitting || teams.length === 0 || (selectedPod?.agentIds?.length || 0) === 0}
                       title={ (selectedPod?.agentIds?.length || 0) === 0 ? "No agents in pod" : "Randomly assign agents"}
                     >
                         <Shuffle className="mr-2 h-4 w-4" /> Random Assign
                     </Button>
                     <Button onClick={handleSaveTeams} disabled={isSubmitting || unassignedAgents.length > 0}>
                         {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                         Save Teams
                     </Button>
                      {unassignedAgents.length > 0 && (
                        <p className="text-xs text-destructive flex items-center gap-1 w-full justify-end">
                            <AlertCircle className="h-3 w-3"/> {unassignedAgents.length} agent(s) unassigned.
                        </p>
                      )}
                 </div>

                  {/* Team Columns - Placeholder for Drag & Drop */}
                  {/* TODO: Replace this section with Drag & Drop implementation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Unassigned Agents Column */}
                      <Card className="bg-muted/30">
                          <CardHeader className="p-4">
                              <CardTitle className="text-base">Unassigned Agents ({unassignedAgents.length})</CardTitle>
                          </CardHeader>
                           <ScrollArea className="h-60 p-4 border-t">
                              {unassignedAgents.length === 0 ? (
                                 <p className="text-sm text-muted-foreground text-center py-4">All agents assigned.</p>
                              ) : (
                                 <div className="space-y-2">
                                     {unassignedAgents.map(agent => (
                                         <Card key={agent.id} className="p-2 text-sm bg-card shadow-sm">
                                             {agent.name}
                                         </Card>
                                     ))}
                                 </div>
                              )}
                           </ScrollArea>
                      </Card>

                       {/* Team Columns */}
                      {teams.map((team) => (
                          <Card key={team.id} className="flex flex-col">
                              <CardHeader className="p-4">
                                   <Label htmlFor={`team-name-${team.id}`} className="sr-only">Team Name</Label>
                                  <Input
                                      id={`team-name-${team.id}`}
                                      value={team.name}
                                      onChange={(e) => handleTeamNameChange(team.id, e.target.value)}
                                      placeholder={`Team ${team.id.split('-')[1]}`}
                                      className="text-base font-semibold border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
                                      disabled={isSubmitting}
                                  />
                                   <CardDescription>({team.agentIds.length} Agents)</CardDescription>
                              </CardHeader>
                              <ScrollArea className="h-60 p-4 border-t">
                                   {team.agentIds.length === 0 ? (
                                     <p className="text-sm text-muted-foreground text-center py-4">Drag agents here</p>
                                  ) : (
                                    <div className="space-y-2">
                                        {team.agentIds.map(agentId => {
                                            const agent = users.find(u => u.id === agentId);
                                            return (
                                                <Card key={agentId} className="p-2 text-sm bg-card shadow-sm">
                                                    {agent?.name || `Agent ${agentId.substring(0, 5)}...`}
                                                </Card>
                                            );
                                        })}
                                    </div>
                                   )}
                              </ScrollArea>
                          </Card>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">Drag and drop agents between columns to assign them. (Drag & drop not yet implemented)</p>
              </div>
           )}

           {/* Loading State for Team Data */}
           {selectedCompetitionId && selectedPodId && isLoading && (
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
  );
}
