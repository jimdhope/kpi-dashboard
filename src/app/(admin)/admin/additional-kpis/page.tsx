
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
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, PlusCircle, Settings, ArrowDown, ArrowUp } from 'lucide-react';
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
import { AdditionalKpiForm, AdditionalKpiFormData } from '@/components/additional-kpi-form';


export type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';
export type KpiSortOrder = 'desc' | 'asc'; // desc: higher is better, asc: lower is better

export interface AdditionalKpi {
  id: string;
  name: string;
  emoji: string;
  type: AdditionalKpiType;
  maxValue?: number; // Only for 'scoreOutOf' type
  sortOrder?: KpiSortOrder; // Only for 'percentage' and 'scoreOutOf'
}

const kpisCollectionRef = collection(db, 'additionalKpis');

export default function AdditionalKpisPage() {
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<AdditionalKpi | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const q = query(kpisCollectionRef, orderBy('name'));

    const unsubscribe: Unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedKpis: AdditionalKpi[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AdditionalKpi, 'id'>),
      }));
      setKpis(fetchedKpis);
      setIsLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching additional KPIs:", err);
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

  const openAddDialog = () => {
    setSelectedKpi(null);
    setDialogMode('add');
    setIsFormOpen(true);
  };

  const openEditDialog = (kpi: AdditionalKpi) => {
    setSelectedKpi(kpi);
    setDialogMode('edit');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (kpi: AdditionalKpi) => {
    setSelectedKpi(kpi);
    setIsAlertOpen(true);
  };

  const handleFormSubmit = async (data: AdditionalKpiFormData) => {
    const kpiDataToSave: Omit<AdditionalKpi, 'id'> = {
      name: data.name,
      emoji: data.emoji,
      type: data.type,
      // Default sortOrder to 'desc' for 'number' type, use form value otherwise
      sortOrder: data.type === 'number' ? 'desc' : data.sortOrder,
    };
  
    // Conditionally add maxValue
    if (data.type === 'scoreOutOf') {
      const maxValue = data.maxValue;
      if (typeof maxValue === 'number' && !isNaN(maxValue)) {
        kpiDataToSave.maxValue = maxValue;
      }
    }
  
    try {
      if (dialogMode === 'add') {
        await addDoc(kpisCollectionRef, kpiDataToSave);
        toast({ title: "KPI Added", description: `"${data.name}" has been successfully added.` });
      } else if (selectedKpi) {
        // For updates, ensure we clean up fields that don't apply to the new type
        const updateData: Partial<AdditionalKpi> = {
            ...kpiDataToSave
        };
  
        if (updateData.type !== 'scoreOutOf') {
          delete updateData.maxValue;
        }
        if (updateData.type === 'number') {
            delete updateData.sortOrder; // 'number' type defaults to desc, no need to store it
        }
        
        await updateDoc(doc(db, 'additionalKpis', selectedKpi.id), updateData);
        toast({ title: "KPI Updated", description: `"${data.name}" has been successfully updated.` });
      }
      setIsFormOpen(false);
      setSelectedKpi(null);
    } catch (err: any) {
      console.error("Error saving KPI:", err);
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
        await deleteDoc(doc(db, 'additionalKpis', selectedKpi.id));
        toast({
          title: "KPI Deleted",
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
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Setup Additional KPIs</CardTitle>
                <CardDescription>Define the performance metrics that are tracked outside of competitions.</CardDescription>
              </div>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} disabled={isLoading}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add KPI
                </Button>
              </DialogTrigger>
            </CardHeader>
            <CardContent>
              {error && <div className="mb-4 text-center text-destructive">{error}</div>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Emoji</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead className="text-right w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <TableRow key={`loading-${index}`}>
                        <TableCell><Skeleton className="h-6 w-6 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-1/4" /></TableCell>
                        <TableCell className="text-right flex gap-1 justify-end"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))
                  ) : kpis.length === 0 && !error ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No KPIs found. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    kpis.map((kpi) => (
                      <TableRow key={kpi.id}>
                        <TableCell className="text-xl">{kpi.emoji}</TableCell>
                        <TableCell className="font-medium">{kpi.name}</TableCell>
                        <TableCell className="text-muted-foreground capitalize">{kpi.type === 'scoreOutOf' ? `Score / ${kpi.maxValue}` : kpi.type}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {kpi.type !== 'number' ? (
                                kpi.sortOrder === 'asc' ? <span className="flex items-center gap-1"><ArrowDown className="h-4 w-4 text-blue-500"/> Lower</span> : <span className="flex items-center gap-1"><ArrowUp className="h-4 w-4 text-green-500"/> Higher</span>
                            ) : (
                                <span className="flex items-center gap-1"><ArrowUp className="h-4 w-4 text-green-500"/> Higher</span>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(kpi)} title={`Edit ${kpi.name}`}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => openDeleteAlert(kpi)} title={`Delete ${kpi.name}`}>
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
                This will permanently delete the KPI <span className="font-semibold">"{selectedKpi?.name}"</span> and all associated score logs. This action cannot be undone.
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
            <DialogTitle>{dialogMode === 'add' ? 'Add New KPI' : 'Edit KPI'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' ? 'Enter the details for the new KPI.' : `Make changes to "${selectedKpi?.name}".`}
            </DialogDescription>
          </DialogHeader>
          <AdditionalKpiForm
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
