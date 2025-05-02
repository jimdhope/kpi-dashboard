
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
import { Edit, Trash2, PlusCircle, Loader2, Users, Shield } from 'lucide-react'; // Added icons
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
import { PodForm, PodFormData } from '@/components/pod-form'; // Create this form component
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import { createUser, AppUser } from '@/services/user'; // Import user service and type


// Pod type definition
export interface Pod {
  id: string;
  name: string;
  logoUrl: string;
  campaignId: string;
  podManagerId: string;
  teamLeaderId: string;
  // Derived data (optional, fetch separately or join)
  campaignName?: string;
  podManagerName?: string;
  teamLeaderName?: string;
}

const podsCollectionRef = collection(db, 'pods');
const campaignsCollectionRef = collection(db, 'campaigns');
const usersCollectionRef = collection(db, 'users'); // Assuming a 'users' collection

export default function AdminPodsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]); // Use AppUser type
  const [isLoadingPods, setIsLoadingPods] = useState(true); // Loading state for pods
  const [isLoadingRelatedData, setIsLoadingRelatedData] = useState(true); // Loading state for campaigns/users
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  // Fetch Campaigns and Users (run once or when needed)
  useEffect(() => {
      const fetchRelatedData = async () => {
          setIsLoadingRelatedData(true);
          setError(null); // Reset error for related data fetch
          try {
              // Fetch campaigns
              const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
              const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
              setCampaigns(fetchedCampaigns);

              // Fetch users (using onSnapshot for potential real-time updates if users are added elsewhere)
              const usersQuery = query(usersCollectionRef, orderBy('name'));
              const unsubscribeUsers = onSnapshot(usersQuery, (userSnapshot) => {
                  const fetchedUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
                  setUsers(fetchedUsers);
                  setError(null); // Clear error if fetch succeeds
                   setIsLoadingRelatedData(false); // Set loading false *after* users are fetched
              }, (err) => {
                   console.error("Error fetching users with snapshot:", err);
                   setError("Failed to load users data. Pod management may be limited.");
                    toast({
                        variant: "destructive",
                        title: "Data Loading Error",
                        description: "Could not load users.",
                    });
                    setIsLoadingRelatedData(false); // Set loading false on error too
              });

              // Return the unsubscribe function for users
              return unsubscribeUsers;

          } catch (err) {
              console.error("Error fetching initial related data (campaigns):", err);
              setError("Failed to load necessary data (campaigns). Pod management may be limited.");
              toast({
                  variant: "destructive",
                  title: "Data Loading Error",
                  description: "Could not load campaigns.",
              });
               setIsLoadingRelatedData(false); // Set loading false on error
               return () => {}; // Return empty unsubscribe if campaign fetch fails
          }
      };

     const unsubscribe = fetchRelatedData();

     // Cleanup function to unsubscribe from users listener
     return () => {
         unsubscribe.then(unsub => unsub()).catch(err => console.error("Error unsubscribing from users", err));
     };

  }, [toast]); // Dependencies


  // Fetch Pods with real-time updates and enrich data
  useEffect(() => {
     // Only fetch pods if related data isn't loading anymore
     if (isLoadingRelatedData) return;

    setIsLoadingPods(true);
    setError(null); // Reset error for pods fetch

    const q = query(podsCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const fetchedPods: Pod[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Pod, 'id'>;
        // Enrich with campaign and user names
        const campaign = campaigns.find(c => c.id === data.campaignId);
        const podManager = users.find(u => u.id === data.podManagerId);
        const teamLeader = users.find(u => u.id === data.teamLeaderId);

        return {
          id: doc.id,
          ...data,
          campaignName: campaign?.name || 'Unknown Campaign',
          podManagerName: podManager?.name || 'N/A', // More specific fallback
          teamLeaderName: teamLeader?.name || 'N/A', // More specific fallback
        };
      });
      setPods(fetchedPods);
      setIsLoadingPods(false); // Set loading false after pods (and derived data) are processed
      setError(null);
    }, (err) => {
      console.error("Error fetching pods with snapshot:", err);
      setError("Failed to fetch pods. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load pods.",
      });
      setIsLoadingPods(false); // Set loading false on error too
    });

    return () => unsubscribe();
    // Re-run if related data changes to re-enrich pods, or if loading state changes
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

   const handleFormSubmit = async (data: PodFormData) => {
        console.log("Form Data Received:", data);

        let finalPodManagerId = data.podManagerId;
        let finalTeamLeaderId = data.teamLeaderId;

        // --- User Creation Logic ---
        try {
            // Create Pod Manager if requested
            if (data.podManagerId === 'create_new' && data.createPodManagerName && data.createPodManagerEmail && data.createPodManagerPassword) {
                toast({ title: "Creating Pod Manager...", description: "Please wait." });
                const newManager = await createUser(
                    data.createPodManagerName,
                    data.createPodManagerEmail,
                    data.createPodManagerPassword,
                    'podManager' // Assign role
                );
                finalPodManagerId = newManager.id!; // Use the new user's ID (Auth UID is used as Firestore ID)
                 toast({ title: "Pod Manager Created", description: `${newManager.name} added.` });
            }

            // Create Team Leader if requested
             if (data.teamLeaderId === 'create_new' && data.createTeamLeaderName && data.createTeamLeaderEmail && data.createTeamLeaderPassword) {
                 toast({ title: "Creating Team Leader...", description: "Please wait." });
                 const newLeader = await createUser(
                     data.createTeamLeaderName,
                     data.createTeamLeaderEmail,
                     data.createTeamLeaderPassword,
                     'teamLeader' // Assign role
                 );
                 finalTeamLeaderId = newLeader.id!; // Use the new user's ID
                 toast({ title: "Team Leader Created", description: `${newLeader.name} added.` });
            }
        } catch (userCreationError: any) {
             console.error("Error creating user during pod submission:", userCreationError);
             toast({
                variant: "destructive",
                title: "User Creation Failed",
                description: userCreationError.message || "Could not create the specified user.",
            });
            return; // Stop pod creation if user creation fails
        }
        // --- End User Creation Logic ---


        // Ensure essential IDs are present after potential user creation
        if (!data.campaignId || !finalPodManagerId || !finalTeamLeaderId) {
             toast({
                variant: "destructive",
                title: "Missing Information",
                description: "Please select a Campaign, Pod Manager, and Team Leader.",
            });
            return; // Prevent submission
        }

        const podDataToSave: Omit<Pod, 'id' | 'campaignName' | 'podManagerName' | 'teamLeaderName'> = {
            name: data.name,
            logoUrl: data.logoUrl || `https://picsum.photos/seed/${data.name.replace(/\s+/g, '-').toLowerCase()}/40`, // Default logo
            campaignId: data.campaignId,
            podManagerId: finalPodManagerId, // Use potentially updated ID
            teamLeaderId: finalTeamLeaderId,   // Use potentially updated ID
        };


        // --- Pod Save/Update Logic ---
        if (dialogMode === 'add') {
            try {
                await addDoc(podsCollectionRef, podDataToSave);
                toast({
                    title: "Pod Added",
                    description: `"${data.name}" has been successfully added.`,
                });
                 setIsFormOpen(false); // Close dialog on success
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
                await updateDoc(podDoc, podDataToSave);
                toast({
                    title: "Pod Updated",
                    description: `"${data.name}" has been successfully updated.`,
                });
                 setIsFormOpen(false); // Close dialog on success
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
        // No need to reset form here, handled by PodForm's onSubmit wrapper
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

   // Determine if the add button should be disabled
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Pods</CardTitle>
                <CardDescription>View, add, edit, or delete pods.</CardDescription>
              </div>
              <DialogTrigger asChild>
                 <Button onClick={openAddDialog} disabled={isAddDisabled} title={addButtonTooltip}>
                   <PlusCircle className="mr-2 h-4 w-4" /> Add Pod
                 </Button>
              </DialogTrigger>
               {/* Informative message when button is disabled */}
                {isAddDisabled && !isLoadingRelatedData && (
                   <p className="text-xs text-muted-foreground">{addButtonTooltip}</p>
                )}
            </CardHeader>
            <CardContent>
              {error && !(isLoadingPods || isLoadingRelatedData) && ( // Show error only when not loading
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
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingPods || isLoadingRelatedData ? ( // Show skeleton if either is loading
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell>
                          <Skeleton className="h-10 w-10 rounded-full" />
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : pods.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(pod)}
                                aria-label={`Edit ${pod.name}`}
                                title={`Edit ${pod.name}`}
                                disabled={isLoadingPods || isLoadingRelatedData || campaigns.length === 0 || users.length === 0} // Disable edit if dependencies missing
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                onClick={() => openDeleteAlert(pod)}
                                aria-label={`Delete ${pod.name}`}
                                title={`Delete ${pod.name}`}
                                disabled={isLoadingPods || isLoadingRelatedData} // Disable while loading
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
          <DialogContent className="sm:max-w-lg"> {/* Wider dialog */}
            <DialogHeader>
              <DialogTitle>{dialogMode === 'add' ? 'Add New Pod' : 'Edit Pod'}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'add' ? 'Enter the details for the new pod. You can select existing users or create new ones.' : `Make changes to the pod "${selectedPod?.name}".`}
              </DialogDescription>
            </DialogHeader>
            {/* Render form only when dependencies are loaded */}
            {!isLoadingRelatedData ? (
                 <PodForm
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    initialData={selectedPod ?? undefined}
                    campaigns={campaigns}
                    users={users} // Pass users list
                    key={selectedPod?.id ?? 'add'} // Re-render form on mode change
                />
            ) : (
                <div className="p-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading form data...</p>
                 </div>
             )}
          </DialogContent>

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
        </AlertDialog>
      </Dialog>
    </div>
  );
}
