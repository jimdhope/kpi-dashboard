
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  orderBy,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompetitionForm, competitionFormSchema } from '@/components/competition-form'; // Import form and schema
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { RuleFormData } from '@/models/types';
import type { Competition } from '@/app/(admin)/admin/competitions/page';
import { z } from 'zod'; // Import Zod for type inference

const campaignsCollectionRef = collection(db, 'campaigns');
const podsCollectionRef = collection(db, 'pods');
const competitionsCollectionRef = collection(db, 'competitions');

export default function EditCompetitionPage() {
  const router = useRouter();
  const params = useParams();
  const competitionId = params.id as string;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch competition data
  useEffect(() => {
    if (!competitionId) {
        setError("Competition ID is missing.");
        setIsLoading(false);
        return;
    }
    const fetchCompetition = async () => {
        setIsLoading(true);
        setError(null);
      try {
        const competitionDocRef = doc(db, 'competitions', competitionId);
        const competitionDocSnap = await getDoc(competitionDocRef);

        if (competitionDocSnap.exists()) {
          setCompetition({ id: competitionDocSnap.id, ...competitionDocSnap.data() } as Competition);
        } else {
          setError("Competition not found.");
        }
      } catch (err) {
        console.error("Error fetching competition:", err);
        setError("Failed to load competition data.");
        toast({ variant: "destructive", title: "Error", description: "Could not load competition." });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCompetition();
  }, [competitionId, toast]);

  // Fetch Campaigns and Pods for the form
  useEffect(() => {
    const fetchRelatedData = async () => {
      setIsLoadingRelated(true);
      try {
        const campaignSnapshot = await getDocs(query(campaignsCollectionRef, orderBy('name')));
        const fetchedCampaigns = campaignSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
        setCampaigns(fetchedCampaigns);

        const podSnapshot = await getDocs(query(podsCollectionRef));
        const fetchedPods = podSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            campaignId: data.campaignId,
            podManagerId: data.podManagerId,
            teamLeaderId: data.teamLeaderId,
            agentIds: data.agentIds || [],
            logoUrl: data.logoUrl || '',
            logoInitials: data.logoInitials || '',
            logoBgColor: data.logoBgColor || '',
          } as Pod;
        });
        setPods(fetchedPods);
      } catch (err) {
        console.error("Error fetching related data (campaigns/pods):", err);
        setError(prev => prev || "Failed to load necessary data for the form."); // Keep existing error if any
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: "Could not load campaigns or pods.",
        });
      } finally {
        setIsLoadingRelated(false);
      }
    };
    fetchRelatedData();
  }, [toast]);

  // Prepare initial data for the form, converting Timestamps to Dates
  const initialFormData = useMemo(() => {
    if (competition) {
      return {
        ...competition,
        startDate: competition.startDate instanceof Timestamp ? competition.startDate.toDate() : competition.startDate,
        endDate: competition.endDate instanceof Timestamp ? competition.endDate.toDate() : competition.endDate,
        // podIds is already an array
      };
    }
    return undefined;
  }, [competition]);


  // Type assertion for form data received from CompetitionForm
  type ReceivedCompetitionFormData = Omit<z.infer<typeof competitionFormSchema>, 'startDate' | 'endDate'> & {
    startDate: Date;
    endDate: Date;
  };


  const handleUpdateCompetition = async (data: ReceivedCompetitionFormData, rules: RuleFormData[]) => {
    if (!competitionId) return;
    setIsSubmitting(true);
    setError(null);

    try {
        const competitionDocRef = doc(db, 'competitions', competitionId);
        const updateData: Partial<Competition> = {
            name: data.name,
            startDate: Timestamp.fromDate(data.startDate),
            endDate: Timestamp.fromDate(data.endDate),
            rules: rules,
            // Allow updating campaign and pods in edit mode
            campaignId: data.campaignId,
            podIds: data.podIds,
        };

      await updateDoc(competitionDocRef, updateData);
      toast({ title: "Competition Updated", description: `"${data.name}" has been successfully updated.` });
      router.push('/admin/competitions'); // Redirect back to the list
    } catch (err: any) {
      console.error("Error updating competition: ", err);
      setError(err.message || "Failed to update competition.");
      toast({ variant: "destructive", title: "Error Updating Competition", description: err.message || "Failed to update." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showLoader = isLoading || isLoadingRelated;
  const canDisplayForm = !isLoading && !isLoadingRelated && competition && initialFormData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Competition</CardTitle>
          <CardDescription>{`Make changes to the competition "${competition?.name || 'Loading...'}"`}</CardDescription>
        </CardHeader>
        <CardContent>
          {showLoader && (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && !showLoader && (
             <div className="p-10 text-center">
                 <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
                 <p className="text-destructive">{error}</p>
                 <Button variant="outline" className="mt-6" onClick={() => router.push('/admin/competitions')}>
                    Back to Competitions
                 </Button>
             </div>
          )}
          {canDisplayForm && (
            <CompetitionForm
              onSubmit={handleUpdateCompetition}
              onCancel={() => router.push('/admin/competitions')}
              initialData={initialFormData as any} // Cast needed due to Date/Timestamp union in initialData type def
              campaigns={campaigns}
              pods={pods}
              mode="edit"
              key={competitionId} // Force re-render if ID changes (though unlikely here)
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
