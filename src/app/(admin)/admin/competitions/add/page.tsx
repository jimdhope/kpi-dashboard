'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  addDoc,
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
import { Loader2 } from 'lucide-react';
import type { Campaign } from '@/app/(admin)/admin/campaigns/page';
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';
import { z } from 'zod'; // Import Zod for type inference

const campaignsCollectionRef = collection(db, 'campaigns');
const podsCollectionRef = collection(db, 'pods');
const competitionsCollectionRef = collection(db, 'competitions');

export default function AddCompetitionPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Fetch Campaigns and Pods for the form
  useEffect(() => {
    const fetchRelatedData = async () => {
      setIsLoadingRelated(true);
      setError(null);
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
        setError("Failed to load necessary data for the form.");
        toast({
          variant: "destructive",
          title: "Data Loading Error",
          description: "Could not load campaigns or pods for selection.",
        });
      } finally {
        setIsLoadingRelated(false);
      }
    };
    fetchRelatedData();
  }, [toast]);

  // Type assertion for form data received from CompetitionForm
  type ReceivedCompetitionFormData = Omit<z.infer<typeof competitionFormSchema>, 'startDate' | 'endDate'> & {
    startDate: Date;
    endDate: Date;
  };

  const handleAddCompetition = async (data: ReceivedCompetitionFormData, rules: RuleFormData[]) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const competitionDataToSave = {
        name: data.name,
        campaignId: data.campaignId,
        podIds: data.podIds,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: Timestamp.fromDate(data.endDate),
        rules: rules,
      };

      await addDoc(competitionsCollectionRef, competitionDataToSave);
      toast({ title: "Competition Added", description: `"${data.name}" has been successfully created.` });
      router.push('/admin/competitions'); // Redirect back to the list after success
    } catch (err: any) {
      console.error("Error adding competition: ", err);
      setError(err.message || "Failed to add competition.");
      toast({ variant: "destructive", title: "Error Adding Competition", description: err.message || "Failed to add." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Competition</CardTitle>
          <CardDescription>Configure the details for the new competition.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRelated ? (
            <div className="flex justify-center items-center p-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-destructive text-center">{error}</p>
          ) : (
            <CompetitionForm
              onSubmit={handleAddCompetition}
              onCancel={() => router.push('/admin/competitions')} // Redirect back on cancel
              campaigns={campaigns}
              pods={pods}
              mode="add" // Set mode to 'add'
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
