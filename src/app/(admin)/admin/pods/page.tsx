
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
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
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
import { uploadFile } from '@/services/storage'; // Import upload service


// Pod type definition
export interface Pod {
  id: string;
  name: string;
  logoUrl: string; // Store logo URL from storage
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
const POD_LOGO_STORAGE_PATH = 'pod-logos'; // Define storage path

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
     if (isLoadingRelatedData) return; // Don't fetch pods until campaigns/users are loaded

    setIsLoadingPods(true);
    setError(null);

    const q = query(podsCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const fetchedPods: Pod[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Pod, 'id' | 'campaignName' | 'podManagerName' | 'teamLeaderName' | 'agentNames'>; // Exclude derived agentNames
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

   // Updated Pod Form Submission Handler
   const handleFormSubmit = async (data: PodFormData, file?: File) => {
        console.log("Pod Form Data Received:", data);
        let finalLogoUrl = selectedPod?.logoUrl || data.logoUrl || ''; // Start with existing or provided URL

        // --- 1. Handle User Creation ---
        let finalPodManagerId = data.podManagerId;
        let finalTeamLeaderId = data.teamLeaderId;

        try {
            if (data.podManagerId === 'create_new' && data.createPodManagerName && data.createPodManagerEmail && data.createPodManagerPassword) {
                toast({ title: "Creating Pod Manager...", description: "Please wait." });
                const newManager = await createUser(
                    data.createPodManagerName,
                    data.createPodManagerEmail,
                    data.createPodManagerPassword,
                    ['podManager'] // Assign appropriate role
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
                    ['teamLeader'] // Assign appropriate role
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
            return; // Stop if user creation fails
        }

        // --- 2. Handle Logo Upload ---
        if (file) {
            toast({ title: "Uploading logo...", description: "Please wait." });
            try {
                finalLogoUrl = await uploadFile(file, POD_LOGO_STORAGE_PATH);
                toast({ title: "Logo Uploaded", description: "Pod logo successfully uploaded." });

                // If editing and a new logo was uploaded, delete the old one
                 if (dialogMode === 'edit' && selectedPod?.logoUrl && selectedPod.logoUrl !== finalLogoUrl && selectedPod.logoUrl.includes('firebasestorage.googleapis.com')) {
                     try {
                        const oldLogoRef = ref(storage, selectedPod.logoUrl);
                        await deleteObject(oldLogoRef);
                        console.log("Old pod logo deleted:", selectedPod.logoUrl);
                     } catch (deleteError: any) {
                         console.warn("Could not delete old pod logo:", deleteError);
                     }
                 }
            } catch (uploadError: any) {
                console.error("Error uploading pod logo: ", uploadError);
                toast({
                    variant: "destructive",
                    title: "Logo Upload Failed",
                    description: uploadError.message || "Could not upload the pod logo.",
                });
                return; // Stop submission if upload fails
            }
        } else if (!finalLogoUrl) {
             // Use a default placeholder if no file and no existing URL
            finalLogoUrl = `https://picsum.photos/seed/${data.name.replace(/\s+/g, '-').toLowerCase()}/40`;
        }


        // --- 3. Prepare Data for Firestore ---
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
            logoUrl: finalLogoUrl, // Use the final URL
            campaignId: data.campaignId,
            podManagerId: finalPodManagerId,
            teamLeaderId: finalTeamLeaderId,
            agentIds: dialogMode === 'edit' ? (selectedPod?.agentIds || []) : [], // Preserve agents on edit, empty on add
        };


        // --- 4. Save to Firestore ---
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
                 // Cleanup uploaded logo if add fails
                 if (file && finalLogoUrl && finalLogoUrl.includes('firebasestorage.googleapis.com')) {
                     try {
                         const logoRef = ref(storage, finalLogoUrl);
                         await deleteObject(logoRef);
                         console.log("Uploaded pod logo deleted due to Firestore add failure:", finalLogoUrl);
                     } catch (cleanupError) {
                         console.warn("Failed to cleanup uploaded pod logo after add error:", cleanupError);
                     }
                 }
            }
        } else if (dialogMode === 'edit' && selectedPod) {
            try {
                const podDoc = doc(db, 'pods', selectedPod.id);
                await updateDoc(podDoc, podDataToSave); // agentIds are handled separately
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
                // Cleanup newly uploaded logo if update fails
                 if (file && finalLogoUrl && finalLogoUrl !== selectedPod.logoUrl && finalLogoUrl.includes('firebasestorage.googleapis.com')) {
                     try {
                         const newLogoRef = ref(storage, finalLogoUrl);
                         await deleteObject(newLogoRef);
                         console.log("Newly uploaded pod logo deleted due to Firestore update failure:", finalLogoUrl);
                     } catch (cleanupError) {
                         console.warn("Failed to cleanup newly uploaded pod logo after update error:", cleanupError);
                     }
                 }
            }
        }
    };

  const handleConfirmDelete = async () => {
    if (selectedPod) {
       const podToDelete = selectedPod; // Store data before resetting state
      try {
         // 1. Delete Firestore Document
        const podDoc = doc(db, 'pods', podToDelete.id);
        await deleteDoc(podDoc);

         // 2. Delete Logo from Storage
         if (podToDelete.logoUrl && podToDelete.logoUrl.includes('firebasestorage.googleapis.com')) {
             toast({ title: "Deleting logo...", description: "Please wait." });
             try {
                 const logoRef = ref(storage, podToDelete.logoUrl);
                 await deleteObject(logoRef);
                 console.log("Pod logo deleted from storage:", podToDelete.logoUrl);
             } catch (storageError: any) {
                 console.warn("Could not delete pod logo from storage:", storageError);
                  toast({
                     variant: "default",
                     title: "Pod Deleted (Logo Warning)",
                     description: `Pod "${podToDelete.name}" deleted, but its logo might remain in storage.`,
                     duration: 7000,
                 });
             }
         }


        toast({
          variant: "destructive",
          title: "Pod Deleted",
          description: `"${podToDelete.name}" has been deleted.`,
        });
      } catch (err: any) {
        console.error("Error deleting pod: ", err);
        toast({
          variant: "destructive",
          title: "Error Deleting Pod",
          description: err.message || `Failed to delete pod "${podToDelete.name}".`,
        });
      }
      setIsAlertOpen(false);
      setSelectedPod(null);
    }
  };

   // Handler for saving assigned agents (no changes needed here)
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

    const initialFormData = dialogMode === 'edit' ? selectedPod : undefined;


  return (
    <div className="space-y-6">
      {/* Main Dialog for Add/Edit Pod */}
       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogContent className="sm:max-w-lg">
              {/* Moved header inside DialogContent */}
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
                       initialData={initialFormData}
                       campaigns={campaigns}
                       users={users}
                       key={initialFormData?.id ?? 'add'} // Key forces re-render
                   />
               ) : (
                   <div className="p-6 text-center">
                       <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                       <p className="text-muted-foreground">Loading form data...</p>
                   </div>
               )}
           </DialogContent>
       </Dialog>

      {/* Separate Dialog for Managing Agents */}
       <Dialog open={isManageAgentsOpen} onOpenChange={setIsManageAgentsOpen}>
        {selectedPodForAgents && (
            <ManagePodAgentsDialog
                pod={selectedPodForAgents}
                allUsers={users}
                onSave={handleSavePodAgents}
                onClose={() => { setIsManageAgentsOpen(false); setSelectedPodForAgents(null); }}
            />
        )}
       </Dialog>

       {/* Main Card for displaying the list of pods */}
       <Card>
            <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Manage Pods</CardTitle>
                <CardDescription>View, add, edit, delete pods, and manage agents.</CardDescription>
            </div>
             {/* Trigger for the Add/Edit Pod Dialog */}
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
                {/* AlertDialog wraps the Table to ensure triggers are inside */}
                <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px]">Logo</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Campaign</TableHead>
                                <TableHead>Pod Manager</TableHead>
                                <TableHead>Team Leader</TableHead>
                                <TableHead>Agents</TableHead>
                                <TableHead className="text-right w-[200px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoadingPods || isLoadingRelatedData ? (
                            // Loading Skeleton Rows
                            Array.from({ length: 3 }).map((_, index) => (
                            <TableRow key={`loading-${index}`}>
                                <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-1/4" /></TableCell>
                                <TableCell className="text-right">
                                    <div className="flex gap-1 justify-end">
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-8" />
                                        <Skeleton className="h-8 w-8" />
                                    </div>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : pods.length === 0 && !error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
                                        {/* Manage Agents Button - Triggers the *separate* Manage Agents Dialog */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openManageAgentsDialog(pod)}
                                        title={`Manage agents for ${pod.name}`}
                                        disabled={isLoadingPods || isLoadingRelatedData || users.length === 0}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                     {/* Edit Pod Button - Triggers the *main* Add/Edit Pod Dialog */}
                                     {/* DialogTrigger needs to be inside Dialog context */}
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
                                    {/* Delete Pod Button - Triggers the AlertDialog */}
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

                     {/* AlertDialog Content for Delete Confirmation */}
                     {/* Placed here so it's within the AlertDialog context */}
                     <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the pod
                            <span className="font-semibold"> "{selectedPod?.name}"</span> and its logo.
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
                </AlertDialog>
            </CardContent>
        </Card>

    </div>
  );
}


    