'use client'; // Add use client directive

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout';
import { KpiCard } from '@/components/kpi-card';
import { Leaderboard } from '@/components/leaderboard';
import { MotivationCard } from '@/components/motivation-card';
import { getKPIs, KPI, Group } from '@/services/kpi'; // Import getKPIs and types
import { generateMotivationMessage } from '@/ai/flows/generate-motivation-message'; // Import AI flow
import { DollarSign, Target, Users, ShieldCheck, BarChart3 } from 'lucide-react'; // Import icons
import { Card, CardHeader, CardContent } from "@/components/ui/card"; // Import Card components

// Mock data for leaderboards - replace with actual data fetching
const teamLeaderboardEntries = [
  { rank: 1, name: 'Team Alpha', score: 1550, avatarUrl: 'https://picsum.photos/seed/alpha/40' },
  { rank: 2, name: 'Team Bravo', score: 1480, isUser: true, avatarUrl: 'https://picsum.photos/seed/bravo/40' },
  { rank: 3, name: 'Team Charlie', score: 1390, avatarUrl: 'https://picsum.photos/seed/charlie/40' },
  { rank: 4, name: 'Team Delta', score: 1200, avatarUrl: 'https://picsum.photos/seed/delta/40' },
];

const individualLeaderboardEntries = [
  { rank: 1, name: 'Alice Johnson', score: 850, avatarUrl: 'https://picsum.photos/seed/alice/40' },
  { rank: 2, name: 'Bob Williams', score: 820, avatarUrl: 'https://picsum.photos/seed/bob/40' },
  { rank: 3, name: 'Charlie Brown', score: 790, isUser: true, avatarUrl: 'https://picsum.photos/seed/charlie_b/40' },
  { rank: 4, name: 'Diana Davis', score: 750, avatarUrl: 'https://picsum.photos/seed/diana/40' },
];

// Mock group and user IDs - replace with actual context/auth
const MOCK_GROUP_ID = 'pod-bravo-123';
const MOCK_USER_ID = 'user-charlie-456';

const kpiIcons: { [key: string]: React.ReactNode } = {
  'Sales': <DollarSign className="h-4 w-4" />,
  'Customer Acquisition': <Target className="h-4 w-4" />,
  // Add more icons as needed
};

export default function Home() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [motivationMessage, setMotivationMessage] = useState<string | null>(null);
  const [isLoadingMotivation, setIsLoadingMotivation] = useState<boolean>(true);
  const [kpisLoading, setKpisLoading] = useState<boolean>(true); // Added loading state for KPIs

  // Fetch KPIs
  useEffect(() => {
    const fetchKpis = async () => {
      try {
        // Replace with actual group data fetching or context
        const currentGroup: Group = { id: MOCK_GROUP_ID, name: 'Pod Bravo' };
        const fetchedKpis = await getKPIs(currentGroup);
        setKpis(fetchedKpis);
      } catch (error) {
        console.error("Error fetching KPIs:", error);
        // Handle error state (e.g., show a toast notification)
      } finally {
         setKpisLoading(false); // Set loading to false after fetching
      }
    };
    fetchKpis();
  }, []);


  // Fetch initial motivation message
  const fetchMotivation = useCallback(async () => {
    setIsLoadingMotivation(true);
    try {
      const result = await generateMotivationMessage({ groupId: MOCK_GROUP_ID, userId: MOCK_USER_ID });
      setMotivationMessage(result.message);
    } catch (error) {
      console.error("Error generating motivation message:", error);
      setMotivationMessage("Could not generate motivation message. Keep up the great work!");
      // Optionally show a toast notification for the error
    } finally {
      setIsLoadingMotivation(false);
    }
  }, []); // Empty dependency array, fetch only once on mount or when refreshed

  useEffect(() => {
    fetchMotivation();
  }, [fetchMotivation]); // Run once on mount


  return (
    <DashboardLayout>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* KPI Cards */}
         {kpisLoading ? (
           // Show skeleton loaders while KPIs are loading
           Array.from({ length: 2 }).map((_, index) => (
             <Card key={index} className="shadow-md">
               <CardHeader className="pb-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
               </CardHeader>
               <CardContent>
                 <div className="h-8 bg-gray-300 rounded w-1/4 animate-pulse mb-2"></div>
                 <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse mb-3"></div>
                 <div className="h-2 bg-gray-200 rounded w-full animate-pulse mb-1"></div>
                 <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse"></div>
               </CardContent>
             </Card>
           ))
         ) : (
           kpis.map((kpi) => (
            <KpiCard key={kpi.name} kpi={kpi} icon={kpiIcons[kpi.name]} />
          ))
         )}

         {/* Motivation Card - Span 2 columns on smaller screens, 1 on larger */}
         <div className="md:col-span-2 lg:col-span-1">
          <MotivationCard
            message={motivationMessage}
            isLoading={isLoadingMotivation}
            onRefresh={fetchMotivation} // Pass the refresh function
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Leaderboards */}
        <Leaderboard title="Team Leaderboard" entries={teamLeaderboardEntries} description="Pod Bravo Rankings" />
        <Leaderboard title="Individual Leaderboard" entries={individualLeaderboardEntries} description="Your Performance" />
      </div>

    </DashboardLayout>
  );
}
