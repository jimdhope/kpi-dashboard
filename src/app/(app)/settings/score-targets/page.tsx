'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Trash2, PlusCircle, Hash, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface ScoreTarget {
  id: string;
  hashtag: string;
  name: string;
  targetType: 'competition' | 'tracker';
  competitionId: string | null;
  trackerKpiId: string | null;
  defaultPoints: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Competition {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
}

interface TrackerKpi {
  id: string;
  name: string;
}

export default function ScoreTargetsPage() {
  const [targets, setTargets] = useState<ScoreTarget[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<ScoreTarget | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    hashtag: '',
    name: '',
    targetType: 'tracker' as 'competition' | 'tracker',
    competitionId: '',
    trackerKpiId: '',
    defaultPoints: '1',
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [targetsRes, competitionsRes, trackersRes] = await Promise.all([
        fetch('/api/settings/score-targets'),
        fetch('/api/competitions'),
        fetch('/api/trackers'),
      ]);

      if (targetsRes.ok) {
        const data = await targetsRes.json();
        setTargets(data.targets || []);
      }

      if (competitionsRes.ok) {
        const data = await competitionsRes.json();
        const activeCompetitions = (data.competitions || []).filter((c: Competition) => {
          if (!c.startsAt || !c.endsAt) return false;
          const now = new Date();
          return new Date(c.startsAt) <= now && new Date(c.endsAt) >= now;
        });
        setCompetitions(activeCompetitions);
      }

      if (trackersRes.ok) {
        const data = await trackersRes.json();
        setTrackerKpis(data.trackers || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const openAddDialog = () => {
    setSelectedTarget(null);
    setDialogMode('add');
    setFormData({
      hashtag: '',
      name: '',
      targetType: 'tracker',
      competitionId: '',
      trackerKpiId: '',
      defaultPoints: '1',
    });
    setIsFormOpen(true);
  };

  const openEditDialog = (target: ScoreTarget) => {
    setSelectedTarget(target);
    setDialogMode('edit');
    setFormData({
      hashtag: target.hashtag,
      name: target.name,
      targetType: target.targetType,
      competitionId: target.competitionId || '',
      trackerKpiId: target.trackerKpiId || '',
      defaultPoints: String(target.defaultPoints),
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        hashtag: formData.hashtag.startsWith('#') ? formData.hashtag : '#' + formData.hashtag,
        name: formData.name,
        targetType: formData.targetType,
        competitionId: formData.targetType === 'competition' && formData.competitionId ? formData.competitionId : null,
        trackerKpiId: formData.targetType === 'tracker' && formData.trackerKpiId ? formData.trackerKpiId : null,
        defaultPoints: parseInt(formData.defaultPoints) || 1,
      };

      const url = dialogMode === 'add'
        ? '/api/settings/score-targets'
        : `/api/settings/score-targets/${selectedTarget?.id}`;

      const method = dialogMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      toast({
        title: dialogMode === 'add' ? 'Target created' : 'Target updated',
        description: `Hashtag ${payload.hashtag} has been ${dialogMode === 'add' ? 'created' : 'updated'}`,
      });

      setIsFormOpen(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save target',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (target: ScoreTarget) => {
    try {
      const res = await fetch(`/api/settings/score-targets/${target.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      toast({
        title: 'Target deleted',
        description: `Hashtag ${target.hashtag} has been removed`,
      });

      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete target',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (target: ScoreTarget) => {
    try {
      const res = await fetch(`/api/settings/score-targets/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !target.isActive }),
      });

      if (!res.ok) {
        throw new Error('Failed to update');
      }

      toast({
        title: target.isActive ? 'Target disabled' : 'Target enabled',
        description: `Hashtag ${target.hashtag} is now ${target.isActive ? 'disabled' : 'enabled'}`,
      });

      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to toggle target',
        variant: 'destructive',
      });
    }
  };

  const getTargetDetails = (target: ScoreTarget) => {
    if (target.targetType === 'competition') {
      const comp = competitions.find(c => c.id === target.competitionId);
      return comp ? comp.name : 'Unknown competition';
    } else {
      const tracker = trackerKpis.find(t => t.id === target.trackerKpiId);
      return tracker ? tracker.name : 'Unknown tracker';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Hashtag Scores</h1>
          <p className="text-muted-foreground">
            Configure hashtags for agents to log scores from Teams messages
          </p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Hashtag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'add' ? 'Add Hashtag Score Target' : 'Edit Hashtag Score Target'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="hashtag">Hashtag</Label>
                <Input
                  id="hashtag"
                  value={formData.hashtag}
                  onChange={(e) => setFormData({ ...formData, hashtag: e.target.value })}
                  placeholder="#SmartSales"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Smart Sales"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Type</Label>
                <Select
                  value={formData.targetType}
                  onValueChange={(value: 'competition' | 'tracker') =>
                    setFormData({ ...formData, targetType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tracker">Tracker KPI</SelectItem>
                    <SelectItem value="competition">Competition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.targetType === 'tracker' && (
                <div className="space-y-2">
                  <Label>Tracker KPI</Label>
                  <Select
                    value={formData.trackerKpiId}
                    onValueChange={(value) => setFormData({ ...formData, trackerKpiId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tracker" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackerKpis.map((tracker) => (
                        <SelectItem key={tracker.id} value={tracker.id}>
                          {tracker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {formData.targetType === 'competition' && (
                <div className="space-y-2">
                  <Label>Competition</Label>
                  <Select
                    value={formData.competitionId}
                    onValueChange={(value) => setFormData({ ...formData, competitionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a competition" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitions.map((comp) => (
                        <SelectItem key={comp.id} value={comp.id}>
                          {comp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="defaultPoints">Default Points</Label>
                <Input
                  id="defaultPoints"
                  type="number"
                  min="1"
                  value={formData.defaultPoints}
                  onChange={(e) => setFormData({ ...formData, defaultPoints: e.target.value })}
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {dialogMode === 'add' ? 'Create Target' : 'Save Changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Hashtag Targets
          </CardTitle>
          <CardDescription>
            When agents post messages with these hashtags, scores are automatically logged
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hashtag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hashtags configured. Click "Add Hashtag" to create one.
                  </TableCell>
                </TableRow>
              ) : (
                targets.map((target) => (
                  <TableRow key={target.id}>
                    <TableCell className="font-medium">{target.hashtag}</TableCell>
                    <TableCell>{target.name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        target.targetType === 'competition'
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-green-500/20 text-green-500'
                      }`}>
                        {target.targetType}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{getTargetDetails(target)}</TableCell>
                    <TableCell>{target.defaultPoints}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(target)}
                        className="p-1"
                      >
                        {target.isActive ? (
                          <ToggleRight className="h-5 w-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(target)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Hashtag</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete {target.hashtag}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(target)}>
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