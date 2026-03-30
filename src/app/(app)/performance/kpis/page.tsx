'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, PlusCircle, Settings, ArrowDown, ArrowUp, CheckCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type AdditionalKpiType = 'number' | 'percentage' | 'scoreOutOf';
export type KpiSortOrder = 'desc' | 'asc';
export type PassFailOperator = 'gte' | 'lte';

export interface AdditionalKpi {
  id: string;
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder?: KpiSortOrder;
  passFailCriteriaEnabled?: boolean;
  passFailOperator?: PassFailOperator;
  passFailValue?: number;
}

interface KpiFormData {
  name: string;
  initials: string;
  type: AdditionalKpiType;
  maxValue?: number;
  sortOrder: KpiSortOrder;
  passFailCriteriaEnabled: boolean;
  passFailOperator: PassFailOperator;
  passFailValue?: number;
}

export default function AdditionalKpisPage() {
  const [kpis, setKpis] = useState<AdditionalKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<AdditionalKpi | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formInitials, setFormInitials] = useState('');
  const [formType, setFormType] = useState<AdditionalKpiType>('number');
  const [formMaxValue, setFormMaxValue] = useState<string>('');
  const [formSortOrder, setFormSortOrder] = useState<KpiSortOrder>('desc');
  const [formPassFailEnabled, setFormPassFailEnabled] = useState(false);
  const [formPassFailOperator, setFormPassFailOperator] = useState<PassFailOperator>('gte');
  const [formPassFailValue, setFormPassFailValue] = useState<string>('');

  useEffect(() => {
    fetchKpis();
  }, []);

  const fetchKpis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/kpis');
      if (res.ok) {
        const data = await res.json();
        setKpis(data.kpis || []);
      } else {
        setError("Failed to fetch KPIs.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not load KPIs.",
        });
      }
    } catch (err) {
      console.error("Error fetching additional KPIs:", err);
      setError("Failed to fetch KPIs.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load KPIs.",
      });
    }
    setIsLoading(false);
  };

  const openAddDialog = () => {
    setSelectedKpi(null);
    setDialogMode('add');
    resetForm();
    setIsFormOpen(true);
  };

  const openEditDialog = (kpi: AdditionalKpi) => {
    setSelectedKpi(kpi);
    setDialogMode('edit');
    setFormName(kpi.name);
    setFormInitials(kpi.initials);
    setFormType(kpi.type);
    setFormMaxValue(kpi.maxValue?.toString() || '');
    setFormSortOrder(kpi.sortOrder || 'desc');
    setFormPassFailEnabled(kpi.passFailCriteriaEnabled || false);
    setFormPassFailOperator(kpi.passFailOperator || 'gte');
    setFormPassFailValue(kpi.passFailValue?.toString() || '');
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormInitials('');
    setFormType('number');
    setFormMaxValue('');
    setFormSortOrder('desc');
    setFormPassFailEnabled(false);
    setFormPassFailOperator('gte');
    setFormPassFailValue('');
  };

  const openDeleteAlert = (kpi: AdditionalKpi) => {
    setSelectedKpi(kpi);
    setIsAlertOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const kpiData: Record<string, unknown> = {
      name: formName,
      initials: formInitials,
      type: formType,
      sortOrder: formType === 'number' ? 'desc' : formSortOrder,
      passFailCriteriaEnabled: formPassFailEnabled,
    };

    if (formType === 'scoreOutOf' && formMaxValue) {
      kpiData.maxValue = parseFloat(formMaxValue);
    }

    if (formPassFailEnabled) {
      kpiData.passFailOperator = formPassFailOperator;
      kpiData.passFailValue = parseFloat(formPassFailValue) || 0;
    }

    try {
      if (dialogMode === 'add') {
        const res = await fetch('/api/kpis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kpiData),
        });
        if (res.ok) {
          toast({ title: "KPI Added", description: `"${formName}" has been successfully added.` });
          fetchKpis();
        } else {
          throw new Error('Failed to create KPI');
        }
      } else if (selectedKpi) {
        const res = await fetch(`/api/kpis/${selectedKpi.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(kpiData),
        });
        if (res.ok) {
          toast({ title: "KPI Updated", description: `"${formName}" has been successfully updated.` });
          fetchKpis();
        } else {
          throw new Error('Failed to update KPI');
        }
      }
      setIsFormOpen(false);
      setSelectedKpi(null);
      resetForm();
    } catch (err: any) {
      console.error("Error saving KPI:", err);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: err.message || `Failed to save KPI "${formName}".`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedKpi) {
      try {
        const res = await fetch(`/api/kpis/${selectedKpi.id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          toast({
            title: "KPI Deleted",
            description: `"${selectedKpi.name}" has been deleted.`,
          });
          fetchKpis();
        } else {
          throw new Error('Failed to delete KPI');
        }
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Setup Additional KPIs</CardTitle>
            <CardDescription>Define the performance metrics that are tracked outside of competitions.</CardDescription>
          </div>
          <Button onClick={openAddDialog} disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add KPI
          </Button>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 text-center text-destructive">{error}</div>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Initials</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Pass/Fail</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-1/3" /></TableCell>
                    <TableCell className="text-right flex gap-1 justify-end"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : kpis.length === 0 && !error ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No KPIs found. Create one to get started!
                  </TableCell>
                </TableRow>
              ) : (
                kpis.map((kpi) => (
                  <TableRow key={kpi.id}>
                    <TableCell className="font-semibold">{kpi.initials}</TableCell>
                    <TableCell className="font-medium">{kpi.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{kpi.type === 'scoreOutOf' ? `Score / ${kpi.maxValue}` : kpi.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {kpi.type !== 'number' ? (
                        kpi.sortOrder === 'asc' ? <span className="flex items-center gap-1"><ArrowDown className="h-4 w-4 text-blue-500"/> Lower</span> : <span className="flex items-center gap-1"><ArrowUp className="h-4 w-4 text-green-500"/> Higher</span>
                      ) : (
                        <span className="flex items-center gap-1"><ArrowUp className="h-4 w-4 text-green-500"/> Higher</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {kpi.passFailCriteriaEnabled ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-4 w-4 text-green-500"/>
                          {kpi.passFailOperator === 'gte' ? '>=' : '<='} {kpi.passFailValue}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <XCircle className="h-4 w-4 text-gray-400"/>
                          N/A
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(kpi)} title={`Edit ${kpi.name}`} aria-label={`Edit ${kpi.name}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80 hover:bg-destructive/10" onClick={() => openDeleteAlert(kpi)} title={`Delete ${kpi.name}`} aria-label={`Delete ${kpi.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the KPI <span className="font-semibold">"{selectedKpi?.name}"</span> and all associated score logs. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedKpi(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'add' ? 'Add New KPI' : 'Edit KPI'}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'add' ? 'Enter the details for the new KPI.' : `Make changes to "${selectedKpi?.name}".`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Calls Handled"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="initials">Initials</Label>
              <Input
                id="initials"
                value={formInitials}
                onChange={(e) => setFormInitials(e.target.value)}
                placeholder="e.g., CH"
                maxLength={4}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as AdditionalKpiType)}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="scoreOutOf">Score Out Of</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formType === 'scoreOutOf' && (
              <div className="grid gap-2">
                <Label htmlFor="maxValue">Max Value</Label>
                <Input
                  id="maxValue"
                  type="number"
                  value={formMaxValue}
                  onChange={(e) => setFormMaxValue(e.target.value)}
                  placeholder="e.g., 100"
                  min={1}
                />
              </div>
            )}
            {formType !== 'number' && (
              <div className="grid gap-2">
                <Label htmlFor="sortOrder">Goal Direction</Label>
                <Select value={formSortOrder} onValueChange={(v) => setFormSortOrder(v as KpiSortOrder)}>
                  <SelectTrigger id="sortOrder">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Higher is better</SelectItem>
                    <SelectItem value="asc">Lower is better</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="passFailEnabled"
                checked={formPassFailEnabled}
                onChange={(e) => setFormPassFailEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="passFailEnabled">Enable Pass/Fail Criteria</Label>
            </div>
            {formPassFailEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-2">
                  <Label htmlFor="passFailOperator">Operator</Label>
                  <Select value={formPassFailOperator} onValueChange={(v) => setFormPassFailOperator(v as PassFailOperator)}>
                    <SelectTrigger id="passFailOperator">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gte">Greater or Equal (&gt;=)</SelectItem>
                      <SelectItem value="lte">Less or Equal (&lt;=)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="passFailValue">Value</Label>
                  <Input
                    id="passFailValue"
                    type="number"
                    value={formPassFailValue}
                    onChange={(e) => setFormPassFailValue(e.target.value)}
                    placeholder="e.g., 80"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {dialogMode === 'add' ? 'Add KPI' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
