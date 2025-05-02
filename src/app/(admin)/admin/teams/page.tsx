
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
import { Loader2, Users, Shuffle, Save, AlertCircle, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface Team {
  id: string;
  name: string;
  agentIds: string[];
}

// Component for individual draggable agent card
interface DraggableAgentProps {
    agent: AppUser;
    isOverlay?: boolean; // To style the drag overlay differently if needed
}

const DraggableAgent = React.forwardRef<HTMLDivElement, DraggableAgentProps>(
    ({ agent, isOverlay, ...props }, ref) => {
    return (
        <Card
            ref={ref}
            className={cn(
                "p-2 text-sm bg-card shadow-sm flex items-center gap-2 cursor-grab",
                isOverlay && "shadow-lg opacity-80 cursor-grabbing" // Style when dragging
            )}
            {...props} // Spread listeners and style from useSortable
            >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="flex-grow truncate">{agent.name}</span>
            {/* <span className="text-xs text-muted-foreground truncate">({agent.email})</span> */}
        </Card>
    );
});
DraggableAgent.displayName = 'DraggableAgent';


// Component that uses useSortable hook for the agent card
function SortableAgentItem({ agent }: { agent: AppUser }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // Use isDragging to style the original item when dragged
  } = useSortable({ id: agent.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // Make original item semi-transparent while dragging
    zIndex: isDragging ? 10 : undefined, // Ensure dragged item is on top
  };

  return (
      <DraggableAgent
          ref={setNodeRef}
          style={style}
          agent={agent}
          isOverlay={isDragging}
          {...attributes}
          {...listeners}
       />
  );
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
   const [activeId, setActiveId] = useState<string | null>(null); // Store ID of dragged agent
  const { toast } = useToast();

  const competitionsCollectionRef = collection(db, 'competitions');
  const podsCollectionRef = collection(db, 'pods');
  const usersCollectionRef = collection(db, 'users');

    // --- dnd-kit Setup ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            // Require the mouse to move by 10 pixels before activating
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

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
                     // Ensure teams have IDs from the start
                     const existingTeams: Team[] = (compData.teams || []).map((team, index) => ({
                         ...team,
                         id: team.id || `team-${index + 1}-${Date.now()}` // Generate ID if missing
                     }));

                     // Default to 3 empty teams if none exist in the document
                     const teamsToUse = existingTeams.length > 0 ? existingTeams : [
                        { id: `team-1-${Date.now()}`, name: 'Team 1', agentIds: [] },
                        { id: `team-2-${Date.now()}`, name: 'Team 2', agentIds: [] },
                        { id: `team-3-${Date.now()}`, name: 'Team 3', agentIds: [] },
                     ];

                    // 4. Determine unassigned agents
                    const assignedAgentIds = new Set(teamsToUse.flatMap(t => t.agentIds));
                    const currentUnassignedAgents = podAgents.filter(agent => !assignedAgentIds.has(agent.id!));


                    setTeams(teamsToUse);
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

  // Agents available in the selected pod (memoized)
  const podAgents = useMemo(() => {
      if (!selectedPod) return [];
      return users.filter(user => selectedPod.agentIds?.includes(user.id!));
  }, [selectedPod, users]);

  // Get the full agent object being dragged
  const draggedAgent = useMemo(() => {
     if (!activeId) return null;
     // Find in unassigned or any team
     return unassignedAgents.find(a => a.id === activeId) ||
            teams.flatMap(t => t.agentIds)
                 .map(agentId => users.find(u => u.id === agentId))
                 .find(agent => agent?.id === activeId) ||
            null;
  }, [activeId, unassignedAgents, teams, users]);


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

   const handleRandomAssignment = useCallback(() => {
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
     }, [podAgents, teams, toast]);

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

   // --- Drag and Drop Handlers ---

    const findContainer = (id: string): string | null => {
        if (id === 'unassigned' || unassignedAgents.some(agent => agent.id === id)) {
        return 'unassigned';
        }
        for (const team of teams) {
            if (team.id === id || team.agentIds.includes(id)) {
                return team.id;
            }
        }
        return null;
    };

   const handleDragStart = (event: DragStartEvent) => {
       setActiveId(event.active.id as string);
       console.log("Drag Start:", event.active.id);
   };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId === overId) return;

        const activeContainerId = findContainer(activeId);
        const overContainerId = findContainer(overId);

        console.log(`Drag Over: Active ${activeId} (in ${activeContainerId}) -> Over ${overId} (in ${overContainerId})`);


        if (!activeContainerId || !overContainerId || activeContainerId === overContainerId) {
            return;
        }

        setTeams(prevTeams => {
            const nextTeams = [...prevTeams];
            const activeTeamIndex = nextTeams.findIndex(t => t.id === activeContainerId);
            const overTeamIndex = nextTeams.findIndex(t => t.id === overContainerId);

            // Moving from a team
            if (activeTeamIndex !== -1) {
                 const activeItemIndex = nextTeams[activeTeamIndex].agentIds.indexOf(activeId);
                 nextTeams[activeTeamIndex].agentIds.splice(activeItemIndex, 1);
            } else {
                // Moving from unassigned
                 setUnassignedAgents(prev => prev.filter(agent => agent.id !== activeId));
            }

            // Moving to a team
            if (overTeamIndex !== -1) {
                 const overItemIndex = nextTeams[overTeamIndex].agentIds.indexOf(overId);
                 // Insert at the position of the item being dragged over
                 nextTeams[overTeamIndex].agentIds.splice(overItemIndex >= 0 ? overItemIndex : nextTeams[overTeamIndex].agentIds.length, 0, activeId);
            } else {
                 // Moving to unassigned
                 const agentToAdd = users.find(u => u.id === activeId);
                 if (agentToAdd) {
                    // Check if not already in unassigned to prevent duplicates during drag over
                    if (!unassignedAgents.some(a => a.id === activeId)) {
                        setUnassignedAgents(prev => {
                           const overItemIndex = prev.findIndex(a => a.id === overId);
                            const newUnassigned = [...prev];
                             newUnassigned.splice(overItemIndex >= 0 ? overItemIndex : newUnassigned.length, 0, agentToAdd);
                             return newUnassigned;
                        });
                    }
                 }
            }
            return nextTeams;
        });
    };


   const handleDragEnd = (event: DragEndEvent) => {
     const { active, over } = event;
     setActiveId(null); // Clear active drag ID

     if (!over) {
         console.log("Drag End: No target");
         return;
     }

     const activeId = active.id as string;
     const overId = over.id as string; // Can be a container ID ('unassigned', team ID) or another agent ID

      const activeContainerId = findContainer(activeId);
     const overContainerId = findContainer(overId); // Find the container of the item being dropped onto


      console.log(`Drag End: Active ${activeId} (from ${activeContainerId}) -> Over ${overId} (in ${overContainerId})`);


     if (!activeContainerId || !overContainerId) {
         console.log("Drag End: Invalid source or target container");
         return;
     }


     // --- Logic to update state based on drop target ---
       if (activeContainerId !== overContainerId) {
           // --- Moving between containers ---
            const agentToMove = users.find(u => u.id === activeId);
           if (!agentToMove) return;

            // Remove from source
            if (activeContainerId === 'unassigned') {
                setUnassignedAgents(prev => prev.filter(a => a.id !== activeId));
            } else {
                setTeams(prev => prev.map(team =>
                    team.id === activeContainerId
                        ? { ...team, agentIds: team.agentIds.filter(id => id !== activeId) }
                        : team
                ));
            }

            // Add to destination
            if (overContainerId === 'unassigned') {
                 setUnassignedAgents(prev => {
                     // Find insertion index based on where it was dropped over
                     const overIndex = prev.findIndex(a => a.id === overId);
                     const newAgents = [...prev];
                     newAgents.splice(overIndex >= 0 ? overIndex : newAgents.length, 0, agentToMove);
                     return newAgents;
                 });
            } else {
                setTeams(prev => prev.map(team => {
                    if (team.id === overContainerId) {
                        const overIndex = team.agentIds.indexOf(overId);
                        const newAgentIds = [...team.agentIds];
                         // Insert at the position dragged over, or at the end if dropped on container
                         newAgentIds.splice(overIndex >= 0 ? overIndex : newAgentIds.length, 0, activeId);
                        return { ...team, agentIds: newAgentIds };
                    }
                    return team;
                }));
            }

       } else {
           // --- Reordering within the same container ---
            if (activeContainerId === 'unassigned') {
                setUnassignedAgents(prev => {
                    const oldIndex = prev.findIndex(a => a.id === activeId);
                    const newIndex = prev.findIndex(a => a.id === overId);
                    if (oldIndex === -1 || newIndex === -1) return prev; // Should not happen
                    return arrayMove(prev, oldIndex, newIndex);
                });
            } else {
                 setTeams(prev => prev.map(team => {
                    if (team.id === activeContainerId) {
                        const oldIndex = team.agentIds.indexOf(activeId);
                        const newIndex = team.agentIds.indexOf(overId);
                         if (oldIndex === -1 || newIndex === -1) return team; // Should not happen
                        return { ...team, agentIds: arrayMove(team.agentIds, oldIndex, newIndex) };
                    }
                    return team;
                 }));
            }
       }

   };


    // Function to get agent object by ID
    const getAgentById = (id: string): AppUser | undefined => users.find(u => u.id === id);

  return (
     <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
    >
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
                        disabled={isSubmitting || teams.length === 0 || podAgents.length === 0}
                        title={ podAgents.length === 0 ? "No agents in pod" : "Randomly assign agents"}
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

                    {/* Team Columns with Drag & Drop */}
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                         {/* --- Unassigned Agents Column --- */}
                        <Card className="bg-muted/30 flex flex-col">
                             <CardHeader className="p-4">
                                 <CardTitle className="text-base">Unassigned Agents ({unassignedAgents.length})</CardTitle>
                             </CardHeader>
                             <ScrollArea className="flex-grow p-4 border-t min-h-[200px]">
                                <SortableContext items={unassignedAgents.map(a => a.id!)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2">
                                        {unassignedAgents.length === 0 ? (
                                             <p className="text-sm text-muted-foreground text-center py-4">All agents assigned.</p>
                                        ) : (
                                            unassignedAgents.map(agent => (
                                                 <SortableAgentItem key={agent.id} agent={agent} />
                                            ))
                                        )}
                                    </div>
                                </SortableContext>
                             </ScrollArea>
                         </Card>

                         {/* --- Team Columns --- */}
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
                                 <ScrollArea className="flex-grow p-4 border-t min-h-[200px]">
                                      <SortableContext items={team.agentIds} strategy={verticalListSortingStrategy}>
                                          <div className="space-y-2">
                                                {team.agentIds.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground text-center py-4">Drag agents here</p>
                                                ) : (
                                                    team.agentIds.map(agentId => {
                                                        const agent = getAgentById(agentId);
                                                        return agent ? <SortableAgentItem key={agentId} agent={agent} /> : null;
                                                    })
                                                )}
                                            </div>
                                        </SortableContext>
                                </ScrollArea>
                            </Card>
                        ))}
                    </div>

                     {/* Drag Overlay - Renders the item being dragged */}
                      {/*
                     <DragOverlay>
                         {activeId && draggedAgent ? (
                             <DraggableAgent agent={draggedAgent} isOverlay />
                         ) : null}
                     </DragOverlay>
                     */}
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
    </DndContext>
  );
}
