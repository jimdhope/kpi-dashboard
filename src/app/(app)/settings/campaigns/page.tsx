'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInitials } from '@/lib/utils';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    async function fetchCampaigns() {
      try {
        const res = await fetch('/api/campaigns');
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        } else {
          setError("Failed to fetch campaigns.");
        }
      } catch (err) {
        console.error("Error fetching campaigns:", err);
        setError("Failed to fetch campaigns.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCampaigns();
  }, []);

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
    const campaignDataToSave = {
      name: data.name,
      description: data.description || null,
      isActive: true,
    };

    try {
      if (dialogMode === 'add') {
        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignDataToSave),
        });
        if (!res.ok) throw new Error('Failed to create campaign');
        toast({ title: "Campaign Created", description: `"${data.name}" has been successfully created.` });
      } else if (selectedCampaign) {
        const res = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignDataToSave),
        });
        if (!res.ok) throw new Error('Failed to update campaign');
        toast({ title: "Campaign Updated", description: `"${data.name}" has been successfully updated.` });
      }
      setIsFormOpen(false);
      setSelectedCampaign(null);
      const res = await fetch('/api/campaigns');
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err: any) {
      console.error("Error saving campaign:", err);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: err.message || `Failed to save campaign "${data.name}".`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedCampaign) return;
    try {
      const res = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete campaign');
      toast({ title: "Campaign Deleted", description: `"${selectedCampaign.name}" has been deleted.` });
      setCampaigns(campaigns.filter(c => c.id !== selectedCampaign.id));
    } catch (err: any) {
      console.error("Error deleting campaign:", err);
      toast({ variant: "destructive", title: "Error Deleting Campaign", description: err.message || `Failed to delete campaign.` });
    }
    setIsAlertOpen(false);
    setSelectedCampaign(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Campaigns</CardTitle>
            <CardDescription>View, add, edit, and delete campaigns. Rules are managed per-competition.</CardDescription>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} disabled={isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Campaign
              </Button>
            </DialogTrigger>
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
                initialData={selectedCampaign ? { name: selectedCampaign.name, description: selectedCampaign.description || '', isActive: selectedCampaign.isActive } : undefined}
                key={selectedCampaign?.id ?? 'add'}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
          {error && !isLoading && (
            <div className="mb-4 text-center text-destructive">{error}</div>
          )}
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
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
                        <AvatarFallback>
                          {generateInitials(campaign.name)}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Dialog open={isFormOpen && selectedCampaign?.id === campaign.id} onOpenChange={(open) => {
                          if (open) openEditDialog(campaign);
                          else {
                            setIsFormOpen(false);
                            setSelectedCampaign(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${campaign.name}`}
                              title={`Edit ${campaign.name}`}
                              disabled={isLoading}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Edit Campaign</DialogTitle>
                              <DialogDescription>
                                Make changes to the campaign "{selectedCampaign?.name}".
                              </DialogDescription>
                            </DialogHeader>
                            <CampaignForm
                              onSubmit={handleFormSubmit}
                              onCancel={() => {
                                setIsFormOpen(false);
                                setSelectedCampaign(null);
                              }}
                              initialData={selectedCampaign ? { name: selectedCampaign.name, description: selectedCampaign.description || '', isActive: selectedCampaign.isActive } : undefined}
                            />
                          </DialogContent>
                        </Dialog>
                        <AlertDialog open={isAlertOpen && selectedCampaign?.id === campaign.id} onOpenChange={(open) => {
                          if (open) openDeleteAlert(campaign);
                          else {
                            setIsAlertOpen(false);
                            setSelectedCampaign(null);
                          }
                        }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                              aria-label={`Delete ${campaign.name}`}
                              title={`Delete ${campaign.name}`}
                              disabled={isLoading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
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
                              <AlertDialogCancel onClick={() => {
                                setIsAlertOpen(false);
                                setSelectedCampaign(null);
                              }}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
