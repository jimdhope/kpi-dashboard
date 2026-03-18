
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
import Link from 'next/link'; // Import Link
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
// Removed CompetitionForm import
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns'; // For formatting dates
import type { Campaign } from '@/app/(admin)/admin/campaigns/page'; // Import Campaign type
import type { Pod } from '@/app/(admin)/admin/pods/page'; // Import Pod type
import type { RuleFormData } from '@/models/types'; // Reuse rule type
import { ScrollArea } from '@/components/ui/scroll-area';

// Competition type definition - kept podIds array
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

// Removed ReceivedCompetitionFormData type

const competitionsCollectionRef = collection(db, 'competitions');
const campaignsCollectionRef = collection(db, 'campaigns'); // Needed for context
const podsCollectionRef = collection(db, 'pods'); // Needed for context

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]); // For context
  const [pods, setPods] = useState<Pod[]>([]); // For context
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true); // Loading state for campaigns/pods
  const [error, setError] = useState<string | null>(null);
  // Removed form state (isFormOpen, dialogMode)
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null); // Keep for delete alert
  const [isDeleting, setIsDeleting] = useState(false); // Added state
  const { toast } = useToast();

   // Fetch Campaigns and Pods for context (to display names)
   useEffect(() => {
    const fetchRelatedData = async () => {
      setIsLoadingRelated(true);
      try {
        const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
        const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        setCampaigns(fetchedCampaigns);

        const podSnapshot = await getDocs(query(podsCollectionRef));
        const fetchedPods = podSnapshot.docs.map(doc => {
            const data = doc.data();
             return {
                id: doc.id,
                name: data.name,
                campaignId: data.campaignId,
                podManagerId: data.podManagerId,
                teamLeaderId: data.teamLeaderId,
                agentIds: data.agentIds || [],
                // Include logo fields
                logoUrl: data.logoUrl || '',
                logoInitials: data.logoInitials || '',
                logoBgColor: data.logoBgColor || '',
             } as Pod;
        });
        setPods(fetchedPods);
        setError(null);
      } catch (err) {
        console.error("Error fetching related data (campaigns/pods):", err);
        setError("Failed to load related context data.");
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: "Could not load campaigns or pods.",
        });
      } finally {
        setIsLoadingRelated(false);
      }
    };
    fetchRelatedData();
  }, [toast]);


  // Fetch Competitions with real-time updates and enrich data
  useEffect(() => {
    if (isLoadingRelated) return; // Wait for campaigns/pods context

    setIsLoading(true);
    setError(null); // Reset error when starting to fetch competitions

    const q = query(competitionsCollectionRef, orderBy('startDate', 'desc'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedCompetitions: Competition[] = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Omit<Competition, 'id' | 'campaignName' | 'podNames'>;
        const campaign = campaigns.find(c => c.id === data.campaignId);
        const participatingPods = pods.filter(p => data.podIds?.includes(p.id));
        const podNames = participatingPods.map(p => p.name).sort();

        return {
          id: doc.id,
          ...data,
          podIds: data.podIds || [],
          startDate: data.startDate,
          endDate: data.endDate,
          rules: data.rules || [],
          campaignName: campaign?.name || 'Unknown Campaign',
          podNames: podNames.length > 0 ? podNames : ['Unknown Pod'],
        };
      });
      setCompetitions(fetchedCompetitions);
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching competitions with snapshot:", err);
      setError("Failed to fetch competitions. Please check connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error Loading Competitions",
        description: "Could not load the competition list.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast, campaigns, pods, isLoadingRelated]);


  const openDeleteAlert = (competition: Competition) => {
    setSelectedCompetition(competition);
    setIsAlertOpen(true);
  };

  // Removed handleFormSubmit

  // Handle confirmation of deletion
  const handleConfirmDelete = async () => {
    if (selectedCompetition) {
      const competitionToDelete = selectedCompetition;
       setIsDeleting(true);
      try {
        const competitionDoc = doc(db, 'competitions', competitionToDelete.id);
        await deleteDoc(competitionDoc);
        toast({ title: "Competition Deleted", description: `Competition "${competitionToDelete.name}" has been deleted.` });
      } catch (err: any) {
        console.error("Error deleting competition: ", err);
        toast({ variant: "destructive", title: "Error Deleting Competition", description: err.message || `Failed to delete.` });
      } finally {
         setIsDeleting(false);
         setIsAlertOpen(false);
         setSelectedCompetition(null);
      }
    }
  };

   // Removed initialFormData calculation

   // Disable Add button if related data isn't loaded
   const isAddDisabled = isLoading || isLoadingRelated || (!isLoadingRelated && (campaigns.length === 0 || pods.length === 0));
    const addButtonTooltip = isLoadingRelated
        ? "Loading campaigns and pods..."
        : (!isLoadingRelated && (campaigns.length === 0 || pods.length === 0))
        ? "Cannot add competitions until Campaigns and Pods are available."
        : "Add a new competition";


  return (
    <div className="space-y-6">
        {/* Only AlertDialog remains */}
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Competitions</CardTitle>
                <CardDescription>Set up, view, edit, or delete weekly competitions involving one or more pods.</CardDescription>
              </div>
              {/* Changed Button to Link */}
               <Link href="/admin/competitions/add" passHref>
                 <Button disabled={isAddDisabled} title={addButtonTooltip} aria-disabled={isAddDisabled}>
                    {isLoadingRelated ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    {isLoadingRelated ? 'Loading Data...' : 'Add Competition'}
                 </Button>
               </Link>
               {isAddDisabled && !isLoading && <p className="text-xs text-muted-foreground">{addButtonTooltip}</p>}
            </CardHeader>
            <CardContent>
              {error && !isLoading && (
                <div className="mb-4 text-center text-destructive">{error}</div>
              )}
              
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : competitions.length === 0 && !error ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No competitions yet</p>
                  <p className="text-sm">Create your first competition to get started!</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {competitions.map((comp) => (
                    <Card key={comp.id} className="frosted-glass hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg line-clamp-1">{comp.name}</CardTitle>
                          <Trophy className="h-5 w-5 text-primary shrink-0" />
                        </div>
                        <CardDescription className="line-clamp-1">{comp.campaignName}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Pods</span>
                            <span className="font-medium truncate max-w-[150px]" title={comp.podNames?.join(', ')}>
                              {comp.podNames?.slice(0, 2).join(', ')}
                              {comp.podNames && comp.podNames.length > 2 && ` +${comp.podNames.length - 2}`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Dates</span>
                            <span className="font-medium text-xs">
                              {comp.startDate ? format(comp.startDate.toDate(), 'MMM d') : 'N/A'} - {comp.endDate ? format(comp.endDate.toDate(), 'MMM d') : 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Rules</span>
                            <span className="font-medium">{comp.rules?.length || 0}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4 pt-4 border-t">
                          <Link href={`/admin/competitions/${comp.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              View
                            </Button>
                          </Link>
                          <Link href={`/admin/competitions/wizard?edit=${comp.id}`} className="flex-1">
                            <Button variant="secondary" size="sm" className="w-full">
                              <Edit className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Removed Add/Edit Dialog Content */}

          {/* Delete Confirmation Alert Dialog Content */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the competition
                <span className="font-semibold"> "{selectedCompetition?.name}"</span>.
                 Associated daily targets might also be affected.
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
      {/* Removed outer Dialog */}
    </div>
  );
}
