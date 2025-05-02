
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Loader2, Users, Shield, UserPlus } from 'lucide-react'; // Added UserPlus icon
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PodForm, PodFormData } from '@/components/pod-form';
import { ManagePodAgentsDialog } from '@/components/manage-pod-agents-dialog'; // Import the new dialog
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import { createUser, AppUser } from '@/services/user';


// Pod type definition
export interface Pod {
  id: string;
  name: string;
  logoUrl: string;
  campaignId: string;
  podManagerId: string;
  teamLeaderId: string;
  agentIds?: string[]; // Add agent IDs array
  // Derived data (optional, fetch separately or join)
  campaignName?: string;
  podManagerName?: string;
  teamLeaderName?: string;
  agentNames?: string[]; // Optional: derived agent names for display
}

const podsCollectionRef = collection(db, 'pods');
const campaignsCollectionRef = collection(db, 'campaigns');
const usersCollectionRef = collection(db, 'users');

export default function AdminPodsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingRelatedData, setIsLoadingRelatedData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isManageAgentsOpen, setIsManageAgentsOpen] = useState(false); // State for manage agents dialog
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [selectedPodForAgents, setSelectedPodForAgents] = useState<Pod | null>(null); // Pod selected for agent management
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  // Fetch Campaigns and Users
  useEffect(() => {
      const fetchRelatedData = async () => {
          setIsLoadingRelatedData(true);
          setError(null);
          try {
              const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
              const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
              setCampaigns(fetchedCampaigns);

              const usersQuery = query(usersCollectionRef, orderBy('name'));
              const unsubscribeUsers = onSnapshot(usersQuery, (userSnapshot) => {
                  const fetchedUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
                  setUsers(fetchedUsers);
                  setError(null);
                  setIsLoadingRelatedData(false);
              }, (err) => {
                   console.error("Error fetching users with snapshot:", err);
                   setError("Failed to load users data. Pod management may be limited.");
                    toast({
                        variant: "destructive",
                        title: "Data Loading Error",
                        description: "Could not load users.",
                    });
                    setIsLoadingRelatedData(false);
              });

              return unsubscribeUsers;

          } catch (err) {
              console.error("Error fetching initial related data (campaigns):", err);
              setError("Failed to load necessary data (campaigns). Pod management may be limited.");
              toast({
                  variant: "destructive",
                  title: "Data Loading Error",
                  description: "Could not load campaigns.",
              });
               setIsLoadingRelatedData(false);
               return () => {};
          }
      };

     const unsubscribePromise = fetchRelatedData();

     return () => {
         unsubscribePromise.then(unsub => unsub()).catch(err => console.error("Error unsubscribing from users", err));
     };

  }, [toast]);


  // Fetch Pods with real-time updates and enrich data
  useEffect(() => {
     if (isLoadingRelatedData) return;

    setIsLoadingPods(true);
    setError(null);

    const q = query(podsCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const fetchedPods: Pod[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Pod, 'id' | 'agentNames'>; // Exclude derived agentNames
        const campaign = campaigns.find(c => c.id === data.campaignId);
        const podManager = users.find(u => u.id === data.podManagerId);
        const teamLeader = users.find(u => u.id === data.teamLeaderId);
        // Enrich with agent names (simple version)
        const agentNames = (data.agentIds || [])
            .map(id => users.find(u => u.id === id)?.name)
            .filter((name): name is string => !!name); // Filter out undefined names


        return {
          id: doc.id,
          ...data,
          agentIds: data.agentIds || [], // Ensure agentIds is always an array
          campaignName: campaign?.name || 'Unknown Campaign',
          podManagerName: podManager?.name || 'N/A',
          teamLeaderName: teamLeader?.name || 'N/A',
          agentNames: agentNames,
        };
      });
      setPods(fetchedPods);
      setIsLoadingPods(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching pods with snapshot:", err);
      setError("Failed to fetch pods. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load pods.",
      });
      setIsLoadingPods(false);
    });

    return () => unsubscribe();
  }, [toast, campaigns, users, isLoadingRelatedData]);


  const openAddDialog = () => {
    setSelectedPod(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (pod: Pod) => {
    setSelectedPod(pod);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (pod: Pod) => {
    setSelectedPod(pod);
    setIsAlertOpen(true);
  };

   const openManageAgentsDialog = (pod: Pod) => {
     setSelectedPodForAgents(pod);
     setIsManageAgentsOpen(true);
   };

   const handleFormSubmit = async (data: PodFormData) => {
        console.log("Form Data Received:", data);

        let finalPodManagerId = data.podManagerId;
        let finalTeamLeaderId = data.teamLeaderId;

        try {
            if (data.podManagerId === 'create_new' && data.createPodManagerName && data.createPodManagerEmail && data.createPodManagerPassword) {
                toast({ title: "Creating Pod Manager...", description: "Please wait." });
                const newManager = await createUser(
                    data.createPodManagerName,
                    data.createPodManagerEmail,
                    data.createPodManagerPassword,
                    'podManager'
                );
                finalPodManagerId = newManager.id!;
                 toast({ title: "Pod Manager Created", description: `${newManager.name} added.` });
            }

             if (data.teamLeaderId === 'create_new' && data.createTeamLeaderName && data.createTeamLeaderEmail && data.createTeamLeaderPassword) {
                 toast({ title: "Creating Team Leader...", description: "Please wait." });
                 const newLeader = await createUser(
                     data.createTeamLeaderName,
                     data.createTeamLeaderEmail,
                     data.createTeamLeaderPassword,
                     'teamLeader'
                 );
                 finalTeamLeaderId = newLeader.id!;
                 toast({ title: "Team Leader Created", description: `${newLeader.name} added.` });
            }
        } catch (userCreationError: any) {
             console.error("Error creating user during pod submission:", userCreationError);
             toast({
                variant: "destructive",
                title: "User Creation Failed",
                description: userCreationError.message || "Could not create the specified user.",
            });
            return;
        }

        if (!data.campaignId || !finalPodManagerId || !finalTeamLeaderId) {
             toast({
                variant: "destructive",
                title: "Missing Information",
                description: "Please select a Campaign, Pod Manager, and Team Leader.",
            });
            return;
        }

        const podDataToSave: Omit<Pod, 'id' | 'campaignName' | 'podManagerName' | 'teamLeaderName' | 'agentNames'> = {
            name: data.name,
            logoUrl: data.logoUrl || `https://picsum.photos/seed/${data.name.replace(/\s+/g, '-').toLowerCase()}/40`,
            campaignId: data.campaignId,
            podManagerId: finalPodManagerId,
            teamLeaderId: finalTeamLeaderId,
            agentIds: initialData?.agentIds || [], // Initialize with empty or existing agents on create/edit
        };


        if (dialogMode === 'add') {
            try {
                await addDoc(podsCollectionRef, podDataToSave);
                toast({
                    title: "Pod Added",
                    description: `"${data.name}" has been successfully added.`,
                });
                 setIsFormOpen(false);
                 setSelectedPod(null);
            } catch (err: any) {
                console.error("Error adding pod: ", err);
                toast({
                    variant: "destructive",
                    title: "Error Adding Pod",
                    description: err.message || `Failed to add pod "${data.name}".`,
                });
            }
        } else if (dialogMode === 'edit' && selectedPod) {
            try {
                const podDoc = doc(db, 'pods', selectedPod.id);
                // Ensure agentIds is preserved during edit if not explicitly changed
                await updateDoc(podDoc, {
                    ...podDataToSave,
                    agentIds: selectedPod.agentIds || [] // Keep existing agents unless changed via Manage Agents dialog
                });
                toast({
                    title: "Pod Updated",
                    description: `"${data.name}" has been successfully updated.`,
                });
                 setIsFormOpen(false);
                 setSelectedPod(null);
            } catch (err: any) {
                console.error("Error updating pod: ", err);
                toast({
                    variant: "destructive",
                    title: "Error Updating Pod",
                    description: err.message || `Failed to update pod "${selectedPod.name}".`,
                });
            }
        }
    };

  const handleConfirmDelete = async () => {
    if (selectedPod) {
      try {
        const podDoc = doc(db, 'pods', selectedPod.id);
        await deleteDoc(podDoc);
        toast({
          variant: "destructive",
          title: "Pod Deleted",
          description: `"${selectedPod.name}" has been deleted.`,
        });
      } catch (err: any) {
        console.error("Error deleting pod: ", err);
        toast({
          variant: "destructive",
          title: "Error Deleting Pod",
          description: err.message || `Failed to delete pod "${selectedPod.name}".`,
        });
      }
      setIsAlertOpen(false);
      setSelectedPod(null);
    }
  };

   // Handler for saving assigned agents
   const handleSavePodAgents = async (podId: string, selectedAgentIds: string[]) => {
     try {
       const podDocRef = doc(db, 'pods', podId);
       await updateDoc(podDocRef, {
         agentIds: selectedAgentIds,
       });
       toast({
         title: "Agents Updated",
         description: `Agent assignments for the pod have been saved.`,
       });
       setIsManageAgentsOpen(false); // Close the dialog
       setSelectedPodForAgents(null);
     } catch (err: any) {
       console.error("Error updating pod agents:", err);
       toast({
         variant: "destructive",
         title: "Error Updating Agents",
         description: err.message || "Failed to save agent assignments.",
       });
     }
   };


   const isAddDisabled = isLoadingRelatedData || isLoadingPods || (!isLoadingRelatedData && (campaigns.length === 0 || users.length === 0));
   const addButtonTooltip = isLoadingRelatedData
        ? "Loading campaigns and users..."
        : (!isLoadingRelatedData && (campaigns.length === 0 || users.length === 0))
        ? "Cannot add pods until Campaigns and Users are available."
        : "Add a new pod";


  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          {/* Manage Agents Dialog Triggered within the Pod Row */}
          <Dialog open={isManageAgentsOpen} onOpenChange={setIsManageAgentsOpen}>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Manage Pods</CardTitle>
                    <CardDescription>View, add, edit, delete pods, and manage agents.</CardDescription>
                </div>
                <DialogTrigger asChild>
                    <Button onClick={openAddDialog} disabled={isAddDisabled} title={addButtonTooltip}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Pod
                    </Button>
                </DialogTrigger>
                {isAddDisabled && !isLoadingRelatedData && (
                    <p className="text-xs text-muted-foreground">{addButtonTooltip}</p>
                )}
                </CardHeader>
                <CardContent>
                {error && !(isLoadingPods || isLoadingRelatedData) && (
                    <div className="mb-4 text-center text-destructive">{error}</div>
                )}
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-[80px]">Logo</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Pod Manager</TableHead>
                        <TableHead>Team Leader</TableHead>
                        <TableHead>Agents</TableHead>
                        <TableHead className="text-right w-[200px]">Actions</TableHead> {/* Increased width */}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoadingPods || isLoadingRelatedData ? (
                        Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={`loading-${index}`}>
                            <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-1/4" /></TableCell> {/* Skeleton for Agents count */}
                            <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" /> {/* Skeleton for Manage Agents button */}
                            </div>
                            </TableCell>
                        </TableRow>
                        ))
                    ) : pods.length === 0 && !error ? (
                        <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground"> {/* Adjusted colSpan */}
                            No pods found. Create one to get started!
                        </TableCell>
                        </TableRow>
                    ) : (
                        pods.map((pod) => (
                        <TableRow key={pod.id}>
                            <TableCell>
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={pod.logoUrl} alt={`${pod.name} logo`} data-ai-hint="pod logo" />
                                <AvatarFallback>{pod.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            </TableCell>
                            <TableCell className="font-medium">{pod.name}</TableCell>
                            <TableCell className="text-muted-foreground">{pod.campaignName}</TableCell>
                            <TableCell className="text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" /> {pod.podManagerName}
                                </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <Shield className="h-3 w-3" /> {pod.teamLeaderName}
                                </span>
                            </TableCell>
                             <TableCell className="text-muted-foreground">
                                <span title={pod.agentNames?.join(', ') || 'No agents assigned'}>
                                    {pod.agentIds?.length || 0}
                                </span>
                             </TableCell>
                            <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                                 {/* Manage Agents Button */}
                                 <DialogTrigger asChild>
                                     <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openManageAgentsDialog(pod)}
                                        title={`Manage agents for ${pod.name}`}
                                        disabled={isLoadingPods || isLoadingRelatedData || users.length === 0}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        {/* <span className="hidden sm:inline ml-1">Agents</span> */}
                                    </Button>
                                 </DialogTrigger>
                                {/* Edit Pod Button */}
                                <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openEditDialog(pod)}
                                    aria-label={`Edit ${pod.name}`}
                                    title={`Edit ${pod.name}`}
                                    disabled={isLoadingPods || isLoadingRelatedData || campaigns.length === 0 || users.length === 0}
                                >
                                    <Edit className="h-4 w-4" />
                                </Button>
                                </DialogTrigger>
                                {/* Delete Pod Button */}
                                <AlertDialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    onClick={() => openDeleteAlert(pod)}
                                    aria-label={`Delete ${pod.name}`}
                                    title={`Delete ${pod.name}`}
                                    disabled={isLoadingPods || isLoadingRelatedData}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                </AlertDialogTrigger>
                            </div>
                            </TableCell>
                        </TableRow>
                        ))
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>

             {/* Pod Add/Edit Form Dialog */}
             <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                <DialogTitle>{dialogMode === 'add' ? 'Add New Pod' : 'Edit Pod'}</DialogTitle>
                <DialogDescription>
                    {dialogMode === 'add' ? 'Enter the details for the new pod. You can select existing users or create new ones.' : `Make changes to the pod "${selectedPod?.name}". Agent assignments are managed separately.`}
                </DialogDescription>
                </DialogHeader>
                {!isLoadingRelatedData ? (
                    <PodForm
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                        initialData={selectedPod ?? undefined}
                        campaigns={campaigns}
                        users={users}
                        key={selectedPod?.id ?? 'add'}
                    />
                ) : (
                    <div className="p-6 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-muted-foreground">Loading form data...</p>
                    </div>
                )}
             </DialogContent>

             {/* Manage Pod Agents Dialog Content */}
              {selectedPodForAgents && (
                 <ManagePodAgentsDialog
                    pod={selectedPodForAgents}
                    allUsers={users}
                    onSave={handleSavePodAgents}
                    onClose={() => { setIsManageAgentsOpen(false); setSelectedPodForAgents(null); }}
                 />
              )}

            {/* Delete Confirmation Alert Dialog */}
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the pod
                    <span className="font-semibold"> "{selectedPod?.name}"</span>.
                    Consider potential impact on associated teams or data.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedPod(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </Dialog> {/* Close Manage Agents Dialog Wrapper */}
        </AlertDialog>
      </Dialog>
    </div>
  );
}
