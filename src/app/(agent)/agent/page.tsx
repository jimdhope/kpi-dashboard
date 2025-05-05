'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { KpiCard } from '@/components/kpi-card';
import { Leaderboard } from '@/components/leaderboard';
// import { MotivationCard } from '@/components/motivation-card'; // Commented out
import { getKPIs, KPI, Group } from '@/services/kpi';
// import { generateMotivationMessage } from '@/ai/flows/generate-motivation-message'; // Commented out
import { DollarSign, Target } from 'lucide-react'; // Agent-specific icons might differ later
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from '@/components/ui/skeleton';

// Mock data - Replace with actual data fetching specific to the logged-in agent
// Assume the agent belongs to Team Bravo and is Charlie Brown
// ADDED unique 'id' field to each entry
const agentTeamLeaderboardEntries = [
  { id: 'team-alpha', rank: 1, name: 'Team Alpha', score: 1550, avatarUrl: 'https://picsum.photos/seed/alpha/40' },
  { id: 'team-bravo', rank: 2, name: 'Team Bravo', score: 1480, isUser: true, avatarUrl: 'https://picsum.photos/seed/bravo/40' }, // Agent's team
  { id: 'team-charlie', rank: 3, name: 'Team Charlie', score: 1390, avatarUrl: 'https://picsum.photos/seed/charlie/40' },
  { id: 'team-delta', rank: 4, name: 'Team Delta', score: 1200, avatarUrl: 'https://picsum.photos/seed/delta/40' },
];

// ADDED unique 'id' field to each entry
const agentIndividualLeaderboardEntries = [
  { id: 'agent-alice', rank: 1, name: 'Alice Johnson', score: 850, avatarUrl: 'https://picsum.photos/seed/alice/40' },
  { id: 'agent-bob', rank: 2, name: 'Bob Williams', score: 820, avatarUrl: 'https://picsum.photos/seed/bob/40' },
  { id: 'agent-charlie', rank: 3, name: 'Charlie Brown', score: 790, isUser: true, avatarUrl: 'https://picsum.photos/seed/charlie_b/40' }, // Agent
  { id: 'agent-diana', rank: 4, name: 'Diana Davis', score: 750, avatarUrl: 'https://picsum.photos/seed/diana/40' },
];

// Mock group and user IDs for the agent
// TODO: Replace with actual IDs from authentication/context
const AGENT_GROUP_ID = 'pod-bravo-123';
const AGENT_USER_ID = 'user-charlie-456';

const kpiIcons: { [key: string]: React.ReactNode } = {
  'Sales': <DollarSign className="h-4 w-4" />,
  'Customer Acquisition': <Target className="h-4 w-4" />,
};

export default function AgentDashboardPage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  // const [motivationMessage, setMotivationMessage] = useState<string | null>(null); // Commented out
  // const [isLoadingMotivation, setIsLoadingMotivation] = useState<boolean>(true); // Commented out
  const [kpisLoading, setKpisLoading] = useState<boolean>(true);

  // Fetch KPIs specific to the agent or their group
  useEffect(() => {
    const fetchAgentKpis = async () => {
      setKpisLoading(true);
      try {
        // Fetch KPIs for the agent's group
        const agentGroup: Group = { id: AGENT_GROUP_ID, name: 'Your Pod (Bravo)' };
        const fetchedKpis = await getKPIs(agentGroup); // getKPIs might need adjustment to filter for agent if needed
        setKpis(fetchedKpis);
      } catch (error) {
        console.error("Error fetching agent KPIs:", error);
      } finally {
        setKpisLoading(false);
      }
    };
    fetchAgentKpis();
  }, []);

  // Fetch personalized motivation message for the agent
  // const fetchMotivation = useCallback(async () => { // Commented out
  //   setIsLoadingMotivation(true);
  //   try {
  //     const result = await generateMotivationMessage({ groupId: AGENT_GROUP_ID, userId: AGENT_USER_ID });
  //     setMotivationMessage(result.message);
  //   } catch (error) {
  //     console.error("Error generating motivation message:", error);
  //     setMotivationMessage("Keep pushing towards your goals! You've got this."); // Agent-specific fallback
  //   } finally {
  //     setIsLoadingMotivation(false);
  //   }
  // }, []);

  // useEffect(() => { // Commented out
  //   fetchMotivation();
  // }, [fetchMotivation]);

  return (
    // AgentSidebarLayout applied by layout.tsx
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"> {/* Adjusted grid cols */}
        {kpisLoading ? (
           Array.from({ length: 3 }).map((_, index) => ( // Show 3 skeletons
             <Card key={index} className="shadow-md">
               <CardHeader className="pb-2">
                 <Skeleton className="h-4 w-1/2 rounded" />
               </CardHeader>
               <CardContent>
                 <Skeleton className="h-8 w-1/4 rounded mb-2" />
                 <Skeleton className="h-3 w-1/3 rounded mb-3" />
                 <Skeleton className="h-2 w-full rounded mb-1" />
                 <Skeleton className="h-3 w-1/4 rounded" />
               </CardContent>
             </Card>
           ))
        ) : (
          kpis.map((kpi, index) => ( // Add index for key fallback if KPI doesn't have a unique ID
            <KpiCard key={kpi.name || index} kpi={kpi} icon={kpiIcons[kpi.name]} />
          ))
        )}

        {/* Motivation Card - Commented Out */}
        {/*
        <div className="md:col-span-2 lg:col-span-1">
          <MotivationCard
            message={motivationMessage}
            isLoading={isLoadingMotivation}
            onRefresh={fetchMotivation}
          />
        </div>
        */}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Leaderboard title="Your Team Rank" entries={agentTeamLeaderboardEntries} description="Pod Bravo Rankings" />
        <Leaderboard title="Your Rank" entries={agentIndividualLeaderboardEntries} description="Individual Performance" />
      </div>
    </>
  );
}
