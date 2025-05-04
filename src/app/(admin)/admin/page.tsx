'use client'; // Add use client directive

import React, { useState, useEffect, useCallback } from 'react';
// No need to import DashboardLayout here, it's handled by layout.tsx
import { KpiCard } from '@/components/kpi-card';
import { Leaderboard } from '@/components/leaderboard';
// import { MotivationCard } from '@/components/motivation-card'; // Commented out
import { getKPIs, KPI, Group } from '@/services/kpi'; // Import getKPIs and types
// import { generateMotivationMessage } from '@/ai/flows/generate-motivation-message'; // Commented out
import { DollarSign, Target, Users, ShieldCheck, BarChart3 } from 'lucide-react'; // Import icons
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"; // Import Card components
import { Skeleton } from '@/components/ui/skeleton'; // Import skeleton

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
const MOCK_USER_ID = 'user-charlie-456'; // This might represent the admin or a selected user context

const kpiIcons: { [key: string]: React.ReactNode } = {
  'Sales': <DollarSign className="h-4 w-4" />,
  'Customer Acquisition': <Target className="h-4 w-4" />,
  // Add more icons as needed
};

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  // const [motivationMessage, setMotivationMessage] = useState<string | null>(null); // Commented out
  // const [isLoadingMotivation, setIsLoadingMotivation] = useState<boolean>(true); // Commented out
  const [kpisLoading, setKpisLoading] = useState<boolean>(true);

  // Fetch KPIs
  useEffect(() => {
    const fetchKpis = async () => {
      setKpisLoading(true); // Ensure loading state is true at start
      try {
        // In admin view, we might fetch KPIs for a specific group or aggregated data
        // For now, stick with the mock group
        const currentGroup: Group = { id: MOCK_GROUP_ID, name: 'Pod Bravo Overview' }; // Name adjusted for context
        // Commenting out actual fetch for now - replace with real data fetching
        // const fetchedKpis = await getKPIs(currentGroup);
        // setKpis(fetchedKpis);

        // Simulate loading finish (remove this when real fetching is added)
        setTimeout(() => setKpisLoading(false), 1000);

      } catch (error) {
        console.error("Error fetching KPIs:", error);
        // Handle error state (e.g., show a toast notification)
        setKpisLoading(false); // Ensure loading stops on error
      }
    };
    fetchKpis();
  }, []);


  // Fetch initial motivation message (maybe for the admin or a general message)
  // const fetchMotivation = useCallback(async () => { // Commented out
  //   setIsLoadingMotivation(true);
  //   try {
  //      // Admin might see a general motivation or one based on overall performance
  //     const result = await generateMotivationMessage({ groupId: MOCK_GROUP_ID, userId: MOCK_USER_ID }); // Using mock IDs for now
  //     setMotivationMessage(result.message);
  //   } catch (error) {
  //     console.error("Error generating motivation message:", error);
  //     setMotivationMessage("Monitor team progress and keep the motivation high!"); // Admin-specific fallback
  //     // Optionally show a toast notification for the error
  //   } finally {
  //     setIsLoadingMotivation(false);
  //   }
  // }, []);

  // useEffect(() => { // Commented out
  //   fetchMotivation();
  // }, [fetchMotivation]);


  return (
    // DashboardLayout is applied by the layout.tsx file
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* KPI Cards */}
         {kpisLoading ? (
           // Show skeleton loaders while KPIs are loading
           Array.from({ length: 2 }).map((_, index) => ( // Show 2 skeletons
             <Card key={index} className="shadow-md">
               <CardHeader className="pb-2">
                 <Skeleton className="h-4 w-1/2 rounded" />
               </CardHeader>
               <CardContent>
                 <Skeleton className="h-8 w-1/2 rounded mb-2" /> {/* Adjusted width */}
                 <Skeleton className="h-3 w-1/3 rounded mb-3" />
                 <Skeleton className="h-2 w-full rounded mb-1" />
                 <Skeleton className="h-3 w-1/4 rounded" />
               </CardContent>
             </Card>
           ))
         ) : (
           kpis.map((kpi) => (
            <KpiCard key={kpi.name} kpi={kpi} icon={kpiIcons[kpi.name]} />
          ))
         )}
          {/* Add placeholder message if no KPIs loaded and not loading */}
          {!kpisLoading && kpis.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3 xl:col-span-4">
                <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No KPI data available to display.</p>
                </CardContent>
            </Card>
          )}

         {/* Motivation Card - Commented Out */}
         {/*
         <div className="md:col-span-2 lg:col-span-1">
          <MotivationCard
            message={motivationMessage}
            isLoading={isLoadingMotivation}
            onRefresh={fetchMotivation} // Pass the refresh function
          />
        </div>
         */}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Leaderboards - Using mock data */}
        <Leaderboard title="Team Leaderboard" entries={teamLeaderboardEntries} description="Overall Pod Rankings" />
        <Leaderboard title="Individual Leaderboard" entries={individualLeaderboardEntries} description="Top Agent Performance" />
      </div>
    </>
  );
}
