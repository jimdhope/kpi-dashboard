'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trophy, PlusCircle, Loader2, Edit, Trash2, Eye, ExternalLink, FileText, Clock, Trash, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Competition {
  id: string;
  name: string;
  startsAt?: string;
  endsAt?: string;
  campaignId?: string;
  campaignName?: string;
  podIds?: string[];
  podNames?: string[];
  rules?: Array<{
    id: string;
    name: string;
    emoji?: string;
    points: number;
  }>;
  isDraft?: boolean;
  autoTeamsUpdates?: boolean;
}

interface Pod {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

interface CompetitionDraft {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  draftData?: {
    currentStep?: number;
  };
  rules?: Array<{ id: string; title: string; points: number }>;
}

export default function ManageCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drafts, setDrafts] = useState<CompetitionDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [confirmationCompetition, setConfirmationCompetition] = useState<Competition | null>(null);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [isConfirmingResult, setIsConfirmingResult] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    async function fetchData() {
      try {
        const [compsRes, podsRes, campaignsRes] = await Promise.all([
          fetch('/api/competitions?includeDrafts=true'),
          fetch('/api/pods'),
          fetch('/api/campaigns'),
        ]);

        if (compsRes.ok) {
          const data = await compsRes.json();
          const comps = data.competitions || [];
          // The API already includes campaign info from the service
          setCompetitions(comps);
        }
        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          setCampaigns(data.campaigns || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await fetch(`/api/competitions/drafts/${draftId}`, { method: 'DELETE' });
      setDrafts(drafts.filter(d => d.id !== draftId));
      toast({ title: 'Draft Deleted', description: 'The draft has been removed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete draft.' });
    }
  };

  const handleDeleteClick = (competition: Competition) => {
    setSelectedCompetition(competition);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCompetition) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/competitions/${selectedCompetition.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Competition Deleted', description: `${selectedCompetition.name} has been deleted.` });
        setCompetitions(competitions.filter(c => c.id !== selectedCompetition.id));
      } else {
        throw new Error('Failed to delete');
      }
      setIsDeleteDialogOpen(false);
      setSelectedCompetition(null);
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete competition.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmResult = async () => {
    if (!confirmationCompetition) return;
    setIsConfirmingResult(true);
    try {
      const response = await fetch(`/api/competitions/${confirmationCompetition.id}/result-confirmation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: confirmationNote.trim() || null }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to confirm results.');
      toast({ title: 'Results confirmed', description: `Official confirmation recorded for ${confirmationCompetition.name}.` });
      setConfirmationCompetition(null); setConfirmationNote('');
    } catch (error) { toast({ variant: 'destructive', title: 'Confirmation failed', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setIsConfirmingResult(false); }
  };

  const setAutoTeamsUpdates = async (competition: Competition, enabled: boolean) => {
    setCompetitions((current) => current.map((item) => item.id === competition.id ? { ...item, autoTeamsUpdates: enabled } : item));
    try {
      const response = await fetch(`/api/competitions/${competition.id}/auto-teams-updates`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to update automatic Teams setting.');
      toast({ title: enabled ? 'Automatic Teams updates enabled' : 'Automatic Teams updates disabled', description: enabled ? 'Changed scores will be sent at the next 15-minute check.' : undefined });
    } catch (error) {
      setCompetitions((current) => current.map((item) => item.id === competition.id ? { ...item, autoTeamsUpdates: !enabled } : item));
      toast({ variant: 'destructive', title: 'Setting not saved', description: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manage Competitions</h1>
            <p className="text-muted-foreground">Create, edit, or delete competitions</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manage Competitions</h1>
          <p className="text-muted-foreground">Create, edit, or delete competitions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Drafts Toggle Button */}
          {drafts.length > 0 && (
            <Button
              variant={showDrafts ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowDrafts(!showDrafts)}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              My Drafts
              <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-xs font-medium">
                {drafts.length}
              </span>
            </Button>
          )}
          <Link href="/competitions/manage/wizard">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Competition
            </Button>
          </Link>
        </div>
      </div>

      {/* Drafts Section */}
      {showDrafts && drafts.length > 0 && (
        <Card className="frosted-glass border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Saved Drafts
            </CardTitle>
            <CardDescription>
              Continue working on your competition drafts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {draft.name || 'Untitled Draft'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Step {((draft.draftData as any)?.currentStep ?? 0) + 1} • {draft.updatedAt 
                          ? format(new Date(draft.updatedAt), 'MMM d, h:mm a')
                          : 'Recently'
                        }
                      </p>
                      {draft.rules && (
                        <p className="text-xs text-muted-foreground">
                          {draft.rules.length} rule{draft.rules.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" className="flex-1 sm:flex-initial gap-1" asChild>
                      <Link href={`/competitions/manage/wizard?draft=${draft.id}`}>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDeleteDraft(draft.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-label="Delete draft" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {competitions.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">No Competitions Yet</h2>
          <p className="text-muted-foreground mb-4">Create your first competition to get started!</p>
          <Link href="/competitions/manage/wizard">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Competition
            </Button>
          </Link>
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
                      {comp.startsAt ? format(new Date(comp.startsAt), 'MMM d') : 'N/A'} - {comp.endsAt ? format(new Date(comp.endsAt), 'MMM d') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rules</span>
                    <span className="font-medium">{comp.rules?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <Label htmlFor={`auto-teams-${comp.id}`} className="text-xs leading-tight">Auto Teams<br /><span className="font-normal text-muted-foreground">Every 15 min if changed</span></Label>
                    <Switch id={`auto-teams-${comp.id}`} checked={Boolean(comp.autoTeamsUpdates)} onCheckedChange={(enabled) => setAutoTeamsUpdates(comp, enabled)} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/competitions?comp=${comp.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/competitions/manage/wizard?edit=${comp.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
                  {comp.endsAt && new Date(comp.endsAt) <= new Date() && <Button variant="secondary" size="sm" onClick={() => { setConfirmationCompetition(comp); setConfirmationNote(''); }}>Confirm</Button>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteClick(comp)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Competition</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the competition
              <span className="font-semibold"> "{selectedCompetition?.name}"</span>.
              Associated daily targets might also be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCompetition(null)} disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Competition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(confirmationCompetition)} onOpenChange={(open) => { if (!open) setConfirmationCompetition(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm official result</DialogTitle><DialogDescription>This records that the provisional leaderboard for {confirmationCompetition?.name} has been checked against the client result. A notification will be sent to agents with a recorded result.</DialogDescription></DialogHeader>
          <Textarea value={confirmationNote} onChange={(event) => setConfirmationNote(event.target.value)} maxLength={1000} placeholder="Client spreadsheet/reference or confirmation note (optional)" disabled={isConfirmingResult} />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmationCompetition(null)} disabled={isConfirmingResult}>Cancel</Button><Button onClick={confirmResult} disabled={isConfirmingResult}>{isConfirmingResult && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm result</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
