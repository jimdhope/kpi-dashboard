
'use client';

import React, { useState, useEffect } from 'react';
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
import { Edit, Trash2, PlusCircle, Loader2, Users, Shield, UserPlus, Search } from 'lucide-react'; // Added Search
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
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
import { Input } from '@/components/ui/input'; // Import Input
import { generateInitials } from '@/lib/utils'; // Import generateInitials

// Pod type definition - Added logoInitials and logoBgColor
export interface Pod {
  id: string;
  name: string;
  logoUrl?: string; // Optional URL
  logoInitials?: string; // Optional custom initials
  logoBgColor?: string; // Optional custom background color
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
  const [searchTerm, setSearchTerm] = useState(''); // State for table search
  const { toast } = useToast();

  // Fetch Campaigns and Users
  useEffect(() => {
      const fetchRelatedData = async () => {
          setIsLoadingRelatedData(true);
          setError(null);
          let unsubscribeUsers: Unsubscribe = () => {}; // Initialize with empty function

          try {
              const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
              const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
              setCampaigns(fetchedCampaigns);

              const usersQuery = query(usersCollectionRef, orderBy('name'));
              unsubscribeUsers = onSnapshot(usersQuery, (userSnapshot) => {
                  const fetchedUsers = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
                  setUsers(fetchedUsers);
                  setError(null); // Clear error on successful user fetch/update
                  setIsLoadingRelatedData(false); // Mark related data as loaded AFTER users are fetched
              }, (err) => {
                   console.error("Error fetching users with snapshot:", err);
                   setError("Failed to load users data. Pod management may be limited.");
                    toast({
                        variant: "destructive",
                        title: "Data Loading Error",
                        description: "Could not load users.",
                    });
                    setIsLoadingRelatedData(false); // Still mark as loaded even if error
              });

          } catch (err) {
              console.error("Error fetching initial related data (campaigns):", err);
              setError("Failed to load necessary data (campaigns). Pod management may be limited.");
              toast({
                  variant: "destructive",
                  title: "Data Loading Error",
                  description: "Could not load campaigns.",
              });
               setIsLoadingRelatedData(false); // Mark as loaded even on error
          }
          return unsubscribeUsers; // Return the unsubscribe function for cleanup
      };

     const unsubscribePromise = fetchRelatedData();

     // Cleanup function for the user listener
     return () => {
         unsubscribePromise.then(unsub => {
             if (typeof unsub === 'function') {
                 unsub(); // Ensure it's a function before calling
             }
         }).catch(err => console.error("Error unsubscribing from users", err));
     };

  }, [toast]);


  // Fetch Pods with real-time updates and enrich data
  useEffect(() => {
     if (isLoadingRelatedData) return; // Don't fetch pods until campaigns/users are available

    setIsLoadingPods(true);
    setError(null); // Reset error when starting to fetch pods

    const q = query(podsCollectionRef, orderBy('name'));

    const unsubscribePods: Unsubscribe = onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
      const fetchedPods: Pod[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Pod, 'id' | 'campaignName' | 'podManagerName' | 'teamLeaderName' | 'agentNames'>;
        const campaign = campaigns.find(c => c.id === data.campaignId);
        const podManager = users.find(u => u.id === data.podManagerId);
        const teamLeader = users.find(u => u.id === data.teamLeaderId);
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
          // Keep logoUrl, logoInitials, logoBgColor as they are from Firestore
          logoUrl: data.logoUrl,
          logoInitials: data.logoInitials,
          logoBgColor: data.logoBgColor,
        };
      });
      setPods(fetchedPods);
      setIsLoadingPods(false);
      setError(null); // Clear error on successful pod fetch/update
    }, (err) => {
      console.error("Error fetching pods with snapshot:", err);
      setError("Failed to fetch pods. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error Loading Pods",
        description: "Could not load the pod list.",
      });
      setIsLoadingPods(false);
    });

    return () => unsubscribePods(); // Cleanup pod listener
  }, [toast, campaigns, users, isLoadingRelatedData]);

  // Filter pods based on search term
  const filteredPods = pods.filter(pod =>
    pod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.campaignName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.podManagerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pod.teamLeaderName?.toLowerCase().includes(searchTerm.toLowerCase())
  );


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

   // Updated Pod Form Submission Handler using logoUrl, logoInitials, logoBgColor
   const handleFormSubmit = async (data: PodFormData) => {
        console.log("Pod Form Data Received:", data);
        let finalLogoUrl = data.logoUrl || ''; // Start with provided URL

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

        // --- 2. Handle Logo URL (No Upload Needed) ---
        // Logo URL takes precedence if provided
        if (finalLogoUrl) {
            console.log(`Using provided logo URL: ${finalLogoUrl}`);
        } else {
            console.log("No logo URL provided. Using fallback avatar (initials/color).");
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

        // Include new logo customization fields
        const podDataToSave: Omit<Pod, 'id' | 'campaignName' | 'podManagerName' | 'teamLeaderName' | 'agentNames'> = {
            name: data.name,
            logoUrl: finalLogoUrl || '', // Save URL or empty string
            logoInitials: data.logoInitials || '', // Save custom initials or empty string
            logoBgColor: data.logoBgColor || '', // Save custom color or empty string
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
            }
        } else if (dialogMode === 'edit' && selectedPod) {
            try {
                const podDoc = doc(db, 'pods', selectedPod.id);
                // Update only the fields that might have changed, including logo customization
                 const updates: Partial<Pod> = {
                    name: data.name,
                    logoUrl: finalLogoUrl || '', // Update or save empty string
                    logoInitials: data.logoInitials || '', // Update or save empty string
                    logoBgColor: data.logoBgColor || '', // Update or save empty string
                    campaignId: data.campaignId,
                    podManagerId: finalPodManagerId,
                    teamLeaderId: finalTeamLeaderId,
                    // agentIds are managed separately
                };
                await updateDoc(podDoc, updates);
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
       const podToDelete = selectedPod; // Store data before resetting state
      try {
         // 1. Delete Firestore Document
        const podDoc = doc(db, 'pods', podToDelete.id);
        await deleteDoc(podDoc);

         // 2. No need to delete logo from Storage

        toast({
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

    // Pass the full Pod object to the form for editing, including logo fields
    const initialFormData = dialogMode === 'edit' ? selectedPod : undefined;


  return (
    <div className="space-y-6">
      {/* Wrap everything in the Dialog and AlertDialog providers */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
         <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            {/* Dialog for Managing Agents */}
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
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className='flex-1'>
                        <CardTitle>Manage Pods</CardTitle>
                        <CardDescription>View, add, edit, delete pods, and manage agents.</CardDescription>
                    </div>
                     <div className='flex gap-2 items-start flex-wrap'>
                        {/* Search Input */}
                         <div className="relative max-w-xs flex-grow">
                             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                             <Input
                                 type="search"
                                 placeholder="Search pods..."
                                 value={searchTerm}
                                 onChange={(e) => setSearchTerm(e.target.value)}
                                 className="pl-8 w-full"
                                 disabled={isLoadingPods || isLoadingRelatedData}
                             />
                         </div>
                          {/* Trigger for the Add/Edit Pod Dialog (inside the Dialog context) */}
                         <DialogTrigger asChild>
                            <Button onClick={openAddDialog} disabled={isAddDisabled} title={addButtonTooltip}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Pod
                            </Button>
                         </DialogTrigger>
                    </div>
                    {isAddDisabled && !isLoadingRelatedData && (
                        <p className="text-xs text-muted-foreground mt-1">{addButtonTooltip}</p>
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
                        ) : filteredPods.length === 0 && !error ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                    {searchTerm ? `No pods found matching "${searchTerm}".` : "No pods found. Create one to get started!"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredPods.map((pod) => (
                            <TableRow key={pod.id}>
                                <TableCell>
                                <Avatar className="h-10 w-10">
                                    {/* Use pod.logoUrl if available, otherwise use Fallback */}
                                     {pod.logoUrl ? (
                                        <AvatarImage src={pod.logoUrl} alt={`${pod.name} logo`} data-ai-hint="pod logo" />
                                     ) : null}
                                    {/* Pass custom initials/color to Fallback */}
                                    <AvatarFallback
                                        initials={pod.logoInitials || generateInitials(pod.name)}
                                        backgroundColor={pod.logoBgColor} // Pass custom color
                                    >
                                       {/* Default initials if no custom/generated initials */}
                                       {!pod.logoInitials && generateInitials(pod.name)}
                                    </AvatarFallback>
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
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openManageAgentsDialog(pod)}
                                            title={`Manage agents for ${pod.name}`}
                                            disabled={isLoadingPods || isLoadingRelatedData || users.length === 0}
                                        >
                                            <UserPlus className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                        {/* Edit Pod Button - Triggers the *main* Add/Edit Pod Dialog */}
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

                     {/* Add/Edit Pod Dialog Content */}
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
                                initialData={initialFormData} // Pass initial data including logo fields
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

                </CardContent>
            </Card>

         </AlertDialog>
      </Dialog>
    </div>
  );
}

