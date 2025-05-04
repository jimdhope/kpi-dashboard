
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  Timestamp, // Import Timestamp for date handling
  getDocs, // To fetch campaigns and pods for the form
  where, // Import where for filtering pods by campaign
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, PlusCircle, Loader2, Trophy } from 'lucide-react';
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
import { CompetitionForm, CompetitionFormData, competitionFormSchema } from '@/components/competition-form'; // Import CompetitionForm and schema
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns'; // For formatting dates
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Import Pod type
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog'; // Reuse rule type
import { z } from 'zod'; // Import Zod for type inference

// Competition type definition - CHANGED podId to podIds array, REMOVED podTargets
export interface Competition {
  id: string;
  name: string;
  startDate: Timestamp; // Use Firestore Timestamp
  endDate: Timestamp; // Use Firestore Timestamp
  campaignId: string;
  podIds: string[]; // Array of Pod IDs participating
  rules: RuleFormData[]; // Store competition-specific rules
  // Derived data (optional, fetch separately or join)
  campaignName?: string;
  podNames?: string[]; // Store multiple pod names
}

// Type for the data received from the form - Expects single podId from form, will convert to array on save
type ReceivedCompetitionFormData = Omit<z.infer<typeof competitionFormSchema>, 'startDate' | 'endDate' | 'podIds'> & {
    startDate: Date;
    endDate: Date;
    podId: string; // Form still sends single podId for now
};

const competitionsCollectionRef = collection(db, 'competitions');
const campaignsCollectionRef = collection(db, 'campaigns'); // Needed for form select
const podsCollectionRef = collection(db, 'pods'); // Needed for form select

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]); // For form select
  const [pods, setPods] = useState<Pod[]>([]); // For form select
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true); // Loading state for campaigns/pods
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false); // Added state
  const [isDeleting, setIsDeleting] = useState(false); // Added state
  const { toast } = useToast();

   // Fetch Campaigns and Pods for the form dropdowns
   useEffect(() => {
    const fetchRelatedData = async () => {
      setIsLoadingRelated(true);
      try {
        const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
        const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        setCampaigns(fetchedCampaigns);

        const podSnapshot = await getDocs(query(podsCollectionRef, orderBy('name')));
        // Enrich pod data minimally for the select dropdown
        const fetchedPods = podSnapshot.docs.map(doc => {
            const data = doc.data();
            const campaign = fetchedCampaigns.find(c => c.id === data.campaignId);
             return {
                id: doc.id,
                name: data.name,
                campaignId: data.campaignId,
                podManagerId: data.podManagerId,
                teamLeaderId: data.teamLeaderId,
                agentIds: data.agentIds || [],
                campaignName: campaign?.name || 'Unknown Campaign',
                // Include logo fields
                logoUrl: data.logoUrl || '',
                logoInitials: data.logoInitials || '',
                logoBgColor: data.logoBgColor || '',
             } as Pod & { campaignName: string };
        });
        setPods(fetchedPods);
        setError(null);
      } catch (err) {
        console.error("Error fetching related data (campaigns/pods):", err);
        setError("Failed to load necessary data for the form.");
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: "Could not load campaigns or pods for selection.",
        });
      } finally {
        setIsLoadingRelated(false);
      }
    };
    fetchRelatedData();
  }, [toast]);


  // Fetch Competitions with real-time updates and enrich data
  useEffect(() => {
    if (isLoadingRelated) return; // Wait for campaigns/pods

    setIsLoading(true);
    setError(null); // Reset error when starting to fetch competitions

    const q = query(competitionsCollectionRef, orderBy('startDate', 'desc')); // Order by start date descending

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedCompetitions: Competition[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Competition, 'id' | 'campaignName' | 'podNames'>;
        const campaign = campaigns.find(c => c.id === data.campaignId);
        // Find names for all participating pods
        const participatingPods = pods.filter(p => data.podIds?.includes(p.id));
        const podNames = participatingPods.map(p => p.name).sort(); // Sort names alphabetically

        return {
          id: doc.id,
          ...data,
          podIds: data.podIds || [], // Ensure podIds is an array
          startDate: data.startDate, // Keep as Timestamp
          endDate: data.endDate, // Keep as Timestamp
          rules: data.rules || [], // Ensure rules is an array
          campaignName: campaign?.name || 'Unknown Campaign',
          podNames: podNames.length > 0 ? podNames : ['Unknown Pod'], // Derived pod names
        };
      });
      setCompetitions(fetchedCompetitions);
      setIsLoading(false);
      setError(null); // Clear error on successful fetch/update
    }, (err) => {
      console.error("Error fetching competitions with snapshot:", err);
      setError("Failed to fetch competitions. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error Loading Competitions",
        description: "Could not load the competition list.",
      });
      setIsLoading(false);
    });

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [toast, campaigns, pods, isLoadingRelated]); // Re-run if campaigns or pods change

  const openAddDialog = () => {
    setSelectedCompetition(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (competition: Competition) => {
    setSelectedCompetition(competition);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (competition: Competition) => {
    setSelectedCompetition(competition);
    setIsAlertOpen(true);
  };

  // Handle form submission for adding/editing competitions - Convert single podId to podIds array
  const handleFormSubmit = async (data: ReceivedCompetitionFormData, rules: RuleFormData[]) => {
    setIsSubmitting(true);

    if (!(data.startDate instanceof Date) || !(data.endDate instanceof Date)) {
        console.error("Invalid date data received in handleFormSubmit:", data);
        toast({ variant: "destructive", title: "Invalid Date", description: "Start date or end date is invalid." });
        setIsSubmitting(false);
        return;
    }

    // Data to save - Convert single podId from form to an array
    const competitionDataToSave = {
        name: data.name,
        campaignId: data.campaignId,
        podIds: [data.podId], // Convert single podId to array (for future multi-pod support)
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
        rules: rules,
        // podTargets removed
    };

    if (dialogMode === 'add') {
        try {
            await addDoc(competitionsCollectionRef, competitionDataToSave);
            toast({ title: "Competition Added", description: `"${data.name}" has been successfully added.` });
            setIsFormOpen(false);
        } catch (err: any) {
            console.error("Error adding competition: ", err);
            toast({ variant: "destructive", title: "Error Adding Competition", description: err.message || "Failed to add." });
        }
    } else if (dialogMode === 'edit' && selectedCompetition) {
        try {
            const competitionDoc = doc(db, 'competitions', selectedCompetition.id);
            // Only update fields editable in the form (podIds won't be editable in this iteration)
            // Include podIds in the update data if the form allows changing it
            const updateData: Partial<Competition> = {
                name: data.name,
                startDate: Timestamp.fromDate(data.startDate),
                endDate: Timestamp.fromDate(data.endDate),
                rules: rules,
                // If form allows editing podId, convert it to podIds array here
                podIds: [data.podId],
                campaignId: data.campaignId, // Update campaign if needed/allowed
            };
            await updateDoc(competitionDoc, updateData);
            toast({ title: "Competition Updated", description: `"${data.name}" has been successfully updated.` });
            setIsFormOpen(false);
            setSelectedCompetition(null);
        } catch (err: any) {
            console.error("Error updating competition: ", err);
            toast({ variant: "destructive", title: "Error Updating Competition", description: err.message || "Failed to update." });
        }
    }
    setIsSubmitting(false);
  };


  // Handle confirmation of deletion
  const handleConfirmDelete = async () => {
    if (selectedCompetition) {
      const competitionToDelete = selectedCompetition;
       setIsDeleting(true); // Set deleting state
      try {
        const competitionDoc = doc(db, 'competitions', competitionToDelete.id);
        await deleteDoc(competitionDoc);
        // TODO: Consider deleting associated daily targets as well?
        toast({ title: "Competition Deleted", description: `Competition "${competitionToDelete.name}" has been deleted.` });
      } catch (err: any) {
        console.error("Error deleting competition: ", err);
        toast({ variant: "destructive", title: "Error Deleting Competition", description: err.message || `Failed to delete.` });
      } finally {
         setIsDeleting(false); // Unset deleting state
         setIsAlertOpen(false);
         setSelectedCompetition(null);
      }
    }
  };

   // Prepare initial data for the form (if editing)
   const initialFormData = useMemo(() => {
       if (dialogMode === 'edit' && selectedCompetition) {
           return {
               ...selectedCompetition,
               // Form expects single podId, use the first one for edit mode display
               // Ensure startDate and endDate are Date objects
               startDate: selectedCompetition.startDate instanceof Timestamp ? selectedCompetition.startDate.toDate() : selectedCompetition.startDate,
               endDate: selectedCompetition.endDate instanceof Timestamp ? selectedCompetition.endDate.toDate() : selectedCompetition.endDate,
               podId: selectedCompetition.podIds?.[0] || '',
           };
       }
       return undefined;
   }, [dialogMode, selectedCompetition]);


   // Disable Add button if related data isn't loaded
   const isAddDisabled = isLoading || isLoadingRelated || (!isLoadingRelated && (campaigns.length === 0 || pods.length === 0));
    const addButtonTooltip = isLoadingRelated
        ? "Loading campaigns and pods..."
        : (!isLoadingRelated && (campaigns.length === 0 || pods.length === 0))
        ? "Cannot add competitions until Campaigns and Pods are available."
        : "Add a new competition";


  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Competitions</CardTitle>
                {/* Updated description - removed targets mention */}
                <CardDescription>Set up, view, edit, or delete weekly competitions.</CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} disabled={isAddDisabled} title={addButtonTooltip}>
                   {isLoadingRelated ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                   {isLoadingRelated ? 'Loading Data...' : 'Add Competition'}
                </Button>
              </DialogTrigger>
               {isAddDisabled && !isLoading && <p className="text-xs text-muted-foreground">{addButtonTooltip}</p>}
            </CardHeader>
            <CardContent>
              {error && !isLoading && (
                <div className="mb-4 text-center text-destructive">{error}</div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>{/* Remove whitespace here */}
                    <TableHead>Name</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Pod(s)</TableHead>{/* Changed heading */}
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>{/* Pods skeleton */}
                        <TableCell><Skeleton className="h-4 w-1/4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/4" /></TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : competitions.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No competitions found. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    competitions.map((comp) => (
                      <TableRow key={comp.id}>
                        <TableCell className="font-medium">{comp.name}</TableCell>
                        <TableCell className="text-muted-foreground">{comp.campaignName}</TableCell>
                        {/* Display multiple pod names */}
                        <TableCell className="text-muted-foreground truncate" title={comp.podNames?.join(', ')}>
                            {comp.podNames?.join(', ') || 'N/A'}
                        </TableCell>
                        <TableCell>{comp.startDate ? format(comp.startDate.toDate(), 'PP') : 'N/A'}</TableCell>
                        <TableCell>{comp.endDate ? format(comp.endDate.toDate(), 'PP') : 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(comp)}
                                aria-label={`Edit ${comp.name}`}
                                title={`Edit ${comp.name}`}
                                disabled={isLoading || isLoadingRelated || isSubmitting}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                onClick={() => openDeleteAlert(comp)}
                                aria-label={`Delete ${comp.name}`}
                                title={`Delete ${comp.name}`}
                                disabled={isLoading || isDeleting}
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

          {/* Add/Edit Competition Dialog Content */}
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'add' ? 'Add New Competition' : 'Edit Competition'}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'add' ? 'Configure the details for the new competition.' : `Make changes to the competition "${selectedCompetition?.name}".`}
              </DialogDescription>
            </DialogHeader>
             {isLoadingRelated ? (
                 <div className="p-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Loading form data...</p>
                </div>
             ) : (
                <CompetitionForm
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    initialData={initialFormData} // Use prepared initial data
                    campaigns={campaigns}
                    pods={pods}
                    mode={dialogMode}
                    key={initialFormData?.id ?? 'add'} // Force re-render
                />
             )}
          </DialogContent>

          {/* Delete Confirmation Alert Dialog Content */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the competition
                <span className="font-semibold"> "{selectedCompetition?.name}"</span>.
                 Associated daily targets might also be affected. {/* Updated warning */}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedCompetition(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                Delete Competition
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>

        </AlertDialog>
      </Dialog>
    </div>
  );
}
