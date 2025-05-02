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
  onSnapshot, // Import onSnapshot for real-time updates
  Unsubscribe, // Import Unsubscribe type
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button'; // Import buttonVariants
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Loader2 } from 'lucide-react';
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
import { CampaignForm, CampaignFormData } from '@/components/campaign-form';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

// Campaign type definition
export interface Campaign {
  id: string;
  name: string;
  logoUrl: string;
}

const campaignsCollectionRef = collection(db, 'campaigns'); // Reference to the 'campaigns' collection

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  // Use useEffect for real-time updates with onSnapshot
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const q = query(campaignsCollectionRef, orderBy('name')); // Order by name

    // Subscribe to real-time updates
    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedCampaigns: Campaign[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Campaign, 'id'>),
      }));
      setCampaigns(fetchedCampaigns);
      setIsLoading(false);
      setError(null); // Clear error on successful fetch/update
    }, (err) => { // Error handler for onSnapshot
      console.error("Error fetching campaigns with snapshot:", err);
      setError("Failed to fetch campaigns. Please check your connection or permissions.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load campaigns.",
      });
      setIsLoading(false);
    });

    // Cleanup function to unsubscribe when component unmounts
    return () => unsubscribe();

  }, [toast]); // Only run once on mount, dependencies are stable

  const openAddDialog = () => {
    setSelectedCampaign(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsAlertOpen(true);
  };

  const handleFormSubmit = async (data: CampaignFormData) => {
     // Show loading state in button (optional, handled by form component)
    if (dialogMode === 'add') {
      try {
        await addDoc(campaignsCollectionRef, data);
        toast({
          title: "Campaign Added",
          description: `"${data.name}" has been successfully added.`,
        });
        // No need to refetch, onSnapshot handles updates
      } catch (err: any) {
        console.error("Error adding campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Adding Campaign",
          description: err.message || `Failed to add campaign "${data.name}". Check console for details.`,
        });
      }
    } else if (dialogMode === 'edit' && selectedCampaign) {
      try {
        const campaignDoc = doc(db, 'campaigns', selectedCampaign.id);
        await updateDoc(campaignDoc, data);
        toast({
          title: "Campaign Updated",
          description: `"${data.name}" has been successfully updated.`,
        });
         // No need to refetch, onSnapshot handles updates
      } catch (err: any) {
        console.error("Error updating campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Updating Campaign",
          description: err.message || `Failed to update campaign "${selectedCampaign.name}". Check console for details.`,
        });
      }
    }
    setIsFormOpen(false); // Close the dialog
    setSelectedCampaign(null); // Reset selection
  };

  const handleConfirmDelete = async () => {
    if (selectedCampaign) {
      try {
        const campaignDoc = doc(db, 'campaigns', selectedCampaign.id);
        await deleteDoc(campaignDoc);
        toast({
          variant: "destructive", // Use default or success variant if preferred
          title: "Campaign Deleted",
          description: `"${selectedCampaign.name}" has been deleted.`,
        });
         // No need to refetch, onSnapshot handles updates
      } catch (err: any) {
        console.error("Error deleting campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Deleting Campaign",
          description: err.message || `Failed to delete campaign "${selectedCampaign.name}". Check console for details.`,
        });
      }
      setIsAlertOpen(false); // Close the alert dialog
      setSelectedCampaign(null); // Reset selection
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Campaigns</CardTitle>
                <CardDescription>View, add, edit, or delete campaigns.</CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} disabled={isLoading}> {/* Disable button while loading */}
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
                </Button>
              </DialogTrigger>
            </CardHeader>
            <CardContent>
              {error && !isLoading && ( // Show error only if not loading
                <div className="mb-4 text-center text-destructive">{error}</div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Logo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Loading Skeleton Rows
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell>
                          <Skeleton className="h-10 w-10 rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-3/4" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : campaigns.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No campaigns found. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={campaign.logoUrl} alt={`${campaign.name} logo`} data-ai-hint="campaign logo"/>
                            <AvatarFallback>{campaign.name.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">{campaign.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(campaign)}
                                aria-label={`Edit ${campaign.name}`}
                                title={`Edit ${campaign.name}`}
                                disabled={isLoading} // Disable while loading
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                onClick={() => openDeleteAlert(campaign)}
                                aria-label={`Delete ${campaign.name}`}
                                title={`Delete ${campaign.name}`}
                                disabled={isLoading} // Disable while loading
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
              {/* TODO: Add pagination controls if necessary */}
            </CardContent>
          </Card>

          {/* Campaign Add/Edit Form Dialog */}
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'add' ? 'Add New Campaign' : 'Edit Campaign'}</DialogTitle>
              <DialogDescription>
                {dialogMode === 'add' ? 'Enter the details for the new campaign.' : `Make changes to the campaign "${selectedCampaign?.name}".`}
              </DialogDescription>
            </DialogHeader>
            <CampaignForm
              onSubmit={handleFormSubmit}
              onCancel={() => setIsFormOpen(false)}
              initialData={selectedCampaign ?? undefined} // Pass initial data for editing
              key={selectedCampaign?.id ?? 'add'} // Force re-render on edit
            />
             {/* Footer is now part of CampaignForm */}
          </DialogContent>

          {/* Delete Confirmation Alert Dialog */}
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the campaign
                <span className="font-semibold"> "{selectedCampaign?.name}"</span> from the database.
                Associated data might also be affected (implement cascade logic if needed).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedCampaign(null)}>Cancel</AlertDialogCancel>
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

// Helper function for button variants - needed if using programmatically like above
// const buttonVariants = ({ variant }: { variant: "destructive" | "default" | null | undefined }) => {
//     if (variant === "destructive") {
//         return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
//     }
//     // Add other variants if needed
//     return ""; // Default or other variants
// };
