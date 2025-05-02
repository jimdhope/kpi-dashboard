'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
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
import { CampaignForm, CampaignFormData } from '@/components/campaign-form'; // Import the new form component
import { useToast } from '@/hooks/use-toast'; // Import useToast for feedback

// Keep Campaign type definition here or move to a shared types file
export interface Campaign {
  id: string;
  name: string;
  logoUrl: string; // URL for the campaign logo
}

// Mock data - In a real app, this would come from a service/API
const initialCampaigns: Campaign[] = [
  { id: 'camp-1', name: 'Q3 Sales Drive', logoUrl: 'https://picsum.photos/seed/q3sales/40' },
  { id: 'camp-2', name: 'New Product Launch', logoUrl: 'https://picsum.photos/seed/productlaunch/40' },
  { id: 'camp-3', name: 'Summer Fest Challenge', logoUrl: 'https://picsum.photos/seed/summerfest/40' },
  { id: 'camp-4', name: 'End of Year Push', logoUrl: 'https://picsum.photos/seed/eoypush/40' },
];

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

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

  const handleFormSubmit = (data: CampaignFormData) => {
    if (dialogMode === 'add') {
      // Add new campaign (simulate adding to a backend)
      const newCampaign: Campaign = {
        id: `camp-${Date.now()}`, // Generate a simple unique ID
        ...data,
      };
      setCampaigns([...campaigns, newCampaign]);
       toast({
          title: "Campaign Added",
          description: `"${newCampaign.name}" has been successfully added.`,
      });
    } else if (dialogMode === 'edit' && selectedCampaign) {
      // Edit existing campaign (simulate updating in a backend)
      setCampaigns(campaigns.map(c =>
        c.id === selectedCampaign.id ? { ...c, ...data } : c
      ));
       toast({
          title: "Campaign Updated",
          description: `"${data.name}" has been successfully updated.`,
       });
    }
    setIsFormOpen(false); // Close the dialog
    setSelectedCampaign(null); // Reset selection
  };

  const handleConfirmDelete = () => {
    if (selectedCampaign) {
      // Delete campaign (simulate deleting from a backend)
      setCampaigns(campaigns.filter(c => c.id !== selectedCampaign.id));
       toast({
          variant: "destructive",
          title: "Campaign Deleted",
          description: `"${selectedCampaign.name}" has been deleted.`,
       });
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
                <Button onClick={openAddDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
                </Button>
              </DialogTrigger>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Logo</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.length === 0 ? (
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
                <span className="font-semibold"> "{selectedCampaign?.name}"</span>.
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
const buttonVariants = ({ variant }: { variant: "destructive" | "default" | null | undefined }) => {
    if (variant === "destructive") {
        return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
    }
    // Add other variants if needed
    return ""; // Default or other variants
};
