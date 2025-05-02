
'use client';

import React, { useState, useEffect } from 'react';
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
} from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, ListChecks } from 'lucide-react'; // Added ListChecks icon
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
import { CampaignForm, CampaignFormData } from '@/components/campaign-form';
import { ManageCampaignRulesDialog } from '@/components/manage-campaign-rules-dialog'; // Import the new dialog
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInitials } from '@/lib/utils'; // Import generateInitials

// Campaign type definition - Added logoInitials and logoBgColor
export interface Campaign {
  id: string;
  name: string;
  logoUrl?: string; // Optional URL to the logo image
  logoInitials?: string; // Optional custom initials
  logoBgColor?: string; // Optional custom background color
}

const campaignsCollectionRef = collection(db, 'campaigns'); // Reference to the 'campaigns' collection

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false); // State for Rules Dialog
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignForRules, setSelectedCampaignForRules] = useState<Campaign | null>(null); // Campaign for Rules Dialog
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
        // Ensure optional fields exist
        logoUrl: doc.data().logoUrl || '',
        logoInitials: doc.data().logoInitials || '',
        logoBgColor: doc.data().logoBgColor || '',
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

  const openRulesDialog = (campaign: Campaign) => {
    setSelectedCampaignForRules(campaign);
    setIsRulesDialogOpen(true);
  };

  // Handle form submission including logo customization
  const handleFormSubmit = async (data: CampaignFormData) => {
    let finalLogoUrl = data.logoUrl || ''; // Get URL from form

    // Prepare data for Firestore, including custom logo fields
    const campaignDataToSave: Omit<Campaign, 'id'> = {
      name: data.name,
      logoUrl: finalLogoUrl || '', // Use URL or empty string
      logoInitials: data.logoInitials || '', // Use custom initials or empty string
      logoBgColor: data.logoBgColor || '', // Use custom color or empty string
    };

    // Add or Update Firestore document
    if (dialogMode === 'add') {
      try {
        await addDoc(campaignsCollectionRef, campaignDataToSave);
        toast({
          title: "Campaign Added",
          description: `"${data.name}" has been successfully added.`,
        });
      } catch (err: any) {
        console.error("Error adding campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Adding Campaign",
          description: err.message || `Failed to add campaign "${data.name}". Check console for details.`,
        });
        return; // Prevent closing dialog on failure
      }
    } else if (dialogMode === 'edit' && selectedCampaign) {
      try {
        const campaignDoc = doc(db, 'campaigns', selectedCampaign.id);
         // Update only the fields that might have changed
         const updates: Partial<Campaign> = {
             name: data.name,
             logoUrl: finalLogoUrl || '',
             logoInitials: data.logoInitials || '',
             logoBgColor: data.logoBgColor || '',
         };
        await updateDoc(campaignDoc, updates);
        toast({
          title: "Campaign Updated",
          description: `"${data.name}" has been successfully updated.`,
        });
      } catch (err: any) {
        console.error("Error updating campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Updating Campaign",
          description: err.message || `Failed to update campaign "${selectedCampaign.name}". Check console for details.`,
        });
        return; // Prevent closing dialog on failure
      }
    }
    setIsFormOpen(false); // Close the dialog on success
    setSelectedCampaign(null); // Reset selection
  };

  const handleConfirmDelete = async () => {
    if (selectedCampaign) {
      const campaignToDelete = selectedCampaign; // Store data before resetting state
      try {
        // Delete Firestore Document
        const campaignDoc = doc(db, 'campaigns', campaignToDelete.id);
        await deleteDoc(campaignDoc);

        toast({
          variant: "destructive", // Use default or success variant if preferred
          title: "Campaign Deleted",
          description: `"${campaignToDelete.name}" has been deleted.`,
        });
      } catch (err: any) {
        console.error("Error deleting campaign: ", err);
        toast({
          variant: "destructive",
          title: "Error Deleting Campaign",
          description: err.message || `Failed to delete campaign "${campaignToDelete.name}". Check console for details.`,
        });
      }
      setIsAlertOpen(false); // Close the alert dialog
      setSelectedCampaign(null); // Reset selection
    }
  };

  // Pass full Campaign object (including logo customization) to form
  const initialData = dialogMode === 'edit' ? selectedCampaign : undefined;


  return (
    <div className="space-y-6">
      {/* Dialog for Adding/Editing Campaigns */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
            initialData={initialData} // Pass initial data including logo fields
            key={initialData?.id ?? 'add'} // Force re-render on edit
          />
        </DialogContent>
      </Dialog>

      {/* Dialog for Managing Campaign Rules */}
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        {selectedCampaignForRules && (
          <ManageCampaignRulesDialog
            campaign={selectedCampaignForRules}
            onClose={() => setIsRulesDialogOpen(false)}
          />
        )}
      </Dialog>

       {/* Alert Dialog for Deleting Campaigns */}
       <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the campaign
                    <span className="font-semibold"> "{selectedCampaign?.name}"</span>.
                    Associated pod data and rules might also be affected.
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

      {/* Main Card for displaying the list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Campaigns</CardTitle>
            <CardDescription>View, add, edit, delete campaigns, and manage rules.</CardDescription>
          </div>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} disabled={isLoading}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
            </Button>
          </DialogTrigger>
        </CardHeader>
        <CardContent>
          {error && !isLoading && (
            <div className="mb-4 text-center text-destructive">{error}</div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
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
                         {campaign.logoUrl ? (
                            <AvatarImage src={campaign.logoUrl} alt={`${campaign.name} logo`} data-ai-hint="campaign logo"/>
                         ) : (
                            <AvatarFallback
                                initials={campaign.logoInitials || generateInitials(campaign.name)}
                                backgroundColor={campaign.logoBgColor}
                            >
                                {/* Render default initials only if no custom/generated */}
                                {!campaign.logoInitials && generateInitials(campaign.name)}
                            </AvatarFallback>
                         )}
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {/* Rules Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRulesDialog(campaign)}
                            aria-label={`Manage rules for ${campaign.name}`}
                            title={`Manage rules for ${campaign.name}`}
                            disabled={isLoading}
                        >
                           <ListChecks className="h-4 w-4" />
                        </Button>
                        {/* Edit Button */}
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
                        {/* Delete Button */}
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

    </div>
  );
}
