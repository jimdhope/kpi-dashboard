
'use client';

import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { logTrackerCreated } from '@/lib/firestore/activities';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, PlusCircle, Settings, ArrowUp } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { TrackerKpiForm, TrackerKpiFormData } from '@/components/tracker-kpi-form';


export interface TrackerKpi {
  id: string;
  name: string;
  initials: string;
  type: 'number'; // Only number type for this feature
}

const kpisCollectionRef = collection(db, 'trackerKpis');

export default function TrackerSetupPage() {
  const [kpis, setKpis] = useState<TrackerKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<TrackerKpi | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  // Current user state for activity logging
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const q = query(kpisCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedKpis: TrackerKpi[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<TrackerKpi, 'id'>),
      }));
      setKpis(fetchedKpis);
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching tracker KPIs:", err);
      setError("Failed to fetch KPIs.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load KPIs.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // Listen for auth state changes to get current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setCurrentUserName(user.displayName || user.email || 'Unknown User');
      } else {
        setCurrentUserId(null);
        setCurrentUserName(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const openAddDialog = () => {
    setSelectedKpi(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (kpi: TrackerKpi) => {
    setSelectedKpi(kpi);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (kpi: TrackerKpi) => {
    setSelectedKpi(kpi);
    setIsAlertOpen(true);
  };

  const handleFormSubmit = async (data: TrackerKpiFormData) => {
    const kpiDataToSave: Omit<TrackerKpi, 'id'> = {
      name: data.name,
      initials: data.initials,
      type: 'number',
    };
  
    try {
      if (dialogMode === 'add') {
        const newKpiRef = await addDoc(kpisCollectionRef, kpiDataToSave);
        
        // Log activity for tracker creation
        if (currentUserId && currentUserName) {
          try {
            await logTrackerCreated(
              currentUserId,
              currentUserName,
              newKpiRef.id,
              data.name
            );
          } catch (logError) {
            // Activity logging failure should not break the save operation
            console.error('Failed to log tracker creation activity:', logError);
          }
        }
        
        toast({ title: "Tracker KPI Added", description: `"${data.name}" has been successfully added.` });
      } else if (selectedKpi) {
        await updateDoc(doc(db, 'trackerKpis', selectedKpi.id), kpiDataToSave);
        toast({ title: "Tracker KPI Updated", description: `"${data.name}" has been successfully updated.` });
      }
      setIsFormOpen(false);
      setSelectedKpi(null);
    } catch (err: any) {
      console.error("Error saving Tracker KPI:", err);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: err.message || `Failed to save KPI "${data.name}".`,
      });
    }
  };


  const handleConfirmDelete = async () => {
    if (selectedKpi) {
      try {
        await deleteDoc(doc(db, 'trackerKpis', selectedKpi.id));
        toast({
          title: "Tracker KPI Deleted",
          description: `"${selectedKpi.name}" has been deleted.`,
        });
      } catch (err: any) {
        console.error("Error deleting KPI:", err);
        toast({
          variant: "destructive",
          title: "Error Deleting KPI",
          description: err.message || `Failed to delete KPI.`,
        });
      }
      setIsAlertOpen(false);
      setSelectedKpi(null);
    }
  };

  return (
    <div className="space-y-6">
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Setup Rolling Trackers</CardTitle>
                <CardDescription>Define the open-ended KPIs to be tracked, like 'Smart Meter Appointments'.</CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} disabled={isLoading}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Tracker KPI
                </Button>
              </DialogTrigger>
            </CardHeader>
            <CardContent>
              {error && <div className="mb-4 text-center text-destructive">{error}</div>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Initials</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 2 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="text-right flex gap-1 justify-end"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : kpis.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No tracker KPIs found. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    kpis.map((kpi) => (
                      <TableRow key={kpi.id}>
                        <TableCell className="font-semibold">{kpi.initials}</TableCell>
                        <TableCell className="font-medium">{kpi.name}</TableCell>
                        <TableCell className="text-muted-foreground capitalize">{kpi.type}</TableCell>
                        <TableCell className="text-muted-foreground">
                           <span className="flex items-center gap-1"><ArrowUp className="h-4 w-4 text-green-500"/> Higher is Better</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(kpi)} title={`Edit ${kpi.name}`} aria-label={`Edit ${kpi.name}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => openDeleteAlert(kpi)} title={`Delete ${kpi.name}`} aria-label={`Delete ${kpi.name}`}>
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the tracker KPI <span className="font-semibold">"{selectedKpi?.name}"</span> and all associated logs. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedKpi(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Add New Tracker KPI' : 'Edit Tracker KPI'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' ? 'Enter the details for the new tracker.' : `Make changes to "${selectedKpi?.name}".`}
            </DialogDescription>
          </DialogHeader>
          <TrackerKpiForm
            onSubmit={handleFormSubmit}
            onCancel={() => setIsFormOpen(false)}
            initialData={selectedKpi}
            key={selectedKpi?.id ?? 'add'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
