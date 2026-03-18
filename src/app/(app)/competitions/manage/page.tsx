'use client';

import React, { useState, useEffect } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, PlusCircle, Loader2, Edit, Trash2, Eye, ExternalLink } from 'lucide-react';
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
  startDate: Timestamp;
  endDate: Timestamp;
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
}

interface Pod {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
}

export default function ManageCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const competitionsQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
    const competitionsUnsub = onSnapshot(competitionsQuery, (snapshot) => {
      const comps = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Competition));
      
      const enrichedComps = comps.map((comp) => {
        const campaign = campaigns.find((c) => c.id === comp.campaignId);
        const podNames = pods
          .filter((p) => comp.podIds?.includes(p.id))
          .map((p) => p.name);
        return {
          ...comp,
          campaignName: campaign?.name || 'Unknown',
          podNames,
        };
      });
      
      setCompetitions(enrichedComps);
      setIsLoading(false);
    });
    unsubscribes.push(competitionsUnsub);

    const podsQuery = query(collection(db, 'pods'), orderBy('name'));
    const podsUnsub = onSnapshot(podsQuery, (snapshot) => {
      setPods(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Pod)));
    });
    unsubscribes.push(podsUnsub);

    const campaignsQuery = query(collection(db, 'campaigns'), orderBy('name'));
    const campaignsUnsub = onSnapshot(campaignsQuery, (snapshot) => {
      setCampaigns(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Campaign)));
    });
    unsubscribes.push(campaignsUnsub);

    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  const handleDeleteClick = (competition: Competition) => {
    setSelectedCompetition(competition);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCompetition) return;
    
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'competitions', selectedCompetition.id));
      toast({ title: 'Competition Deleted', description: `${selectedCompetition.name} has been deleted.` });
      setIsDeleteDialogOpen(false);
      setSelectedCompetition(null);
    } catch (error) {
      console.error('Error deleting competition:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete competition.' });
    } finally {
      setIsDeleting(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Competitions</h1>
          <p className="text-muted-foreground">Create, edit, or delete competitions</p>
        </div>
        <Link href="/admin/competitions/manage/wizard">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Competition
          </Button>
        </Link>
      </div>

      {competitions.length === 0 ? (
        <div className="text-center py-12">
          <Trophy className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">No Competitions Yet</h2>
          <p className="text-muted-foreground mb-4">Create your first competition to get started!</p>
          <Link href="/admin/competitions/manage/wizard">
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
                      {comp.startDate ? format(comp.startDate.toDate(), 'MMM d') : 'N/A'} - {comp.endDate ? format(comp.endDate.toDate(), 'MMM d') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rules</span>
                    <span className="font-medium">{comp.rules?.length || 0}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Link href={`/admin/competitions?comp=${comp.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </Link>
                  <Link href={`/admin/competitions/manage/wizard?edit=${comp.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="mr-1 h-4 w-4" />
                      Edit
                    </Button>
                  </Link>
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
    </div>
  );
}
