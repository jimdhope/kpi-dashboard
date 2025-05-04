
'use client'; // Add use client directive

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Leaderboard } from '@/components/leaderboard';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"; // Import Card components
import { Skeleton } from '@/components/ui/skeleton'; // Import skeleton
import { Users, ShieldCheck, Megaphone, Trophy } from 'lucide-react'; // Import relevant icons

// Mock data for leaderboards - replace with actual data fetching later if needed
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

// Interface for stats card
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  isLoading: boolean;
  description?: string;
}

function StatCard({ title, value, icon, isLoading, description }: StatCardProps) {
  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2 rounded" />
        ) : (
          <div className="text-2xl font-bold text-primary">{value}</div>
        )}
        {description && !isLoading && (
          <p className="text-xs text-muted-foreground pt-1">{description}</p>
        )}
        {isLoading && <Skeleton className="h-3 w-3/4 rounded mt-1" />}
      </CardContent>
    </Card>
  );
}


export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    campaigns: 0,
    pods: 0,
    users: 0,
    activeCompetitions: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Stats Data
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      setError(null);
      try {
        const campaignsQuery = query(collection(db, 'campaigns'));
        const podsQuery = query(collection(db, 'pods'));
        const usersQuery = query(collection(db, 'users'));
        const now = Timestamp.now();
        const activeCompetitionsQuery = query(
          collection(db, 'competitions'),
          where('startDate', '<=', now),
          // We need to filter endDate >= now client-side or use a more complex query/data structure
        );

        const [
          campaignsSnapshot,
          podsSnapshot,
          usersSnapshot,
          competitionsSnapshot,
        ] = await Promise.all([
          getDocs(campaignsQuery),
          getDocs(podsQuery),
          getDocs(usersQuery),
          getDocs(activeCompetitionsQuery),
        ]);

        // Client-side filter for active competitions based on end date
        const activeCompetitions = competitionsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.endDate && data.endDate.toDate() >= now.toDate();
        }).length;


        setStats({
          campaigns: campaignsSnapshot.size,
          pods: podsSnapshot.size,
          users: usersSnapshot.size,
          activeCompetitions: activeCompetitions,
        });

      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        setError("Failed to load dashboard statistics.");
        // Optionally set stats to NaN or show error state in cards
        setStats({ campaigns: NaN, pods: NaN, users: NaN, activeCompetitions: NaN });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);


  return (
    // DashboardLayout is applied by the layout.tsx file
    <>
      {error && (
         <div className="mb-4 text-center text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
       )}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Quick Stats Cards */}
        <StatCard
            title="Total Campaigns"
            value={isLoadingStats ? '-' : stats.campaigns}
            icon={<Megaphone className="h-4 w-4" />}
            isLoading={isLoadingStats}
            description="Manage Campaigns"
        />
        <StatCard
            title="Total Pods"
            value={isLoadingStats ? '-' : stats.pods}
            icon={<ShieldCheck className="h-4 w-4" />}
            isLoading={isLoadingStats}
             description="Manage Pods & Agents"
        />
         <StatCard
            title="Total Users"
            value={isLoadingStats ? '-' : stats.users}
            icon={<Users className="h-4 w-4" />}
            isLoading={isLoadingStats}
             description="Manage User Accounts"
        />
         <StatCard
            title="Active Competitions"
            value={isLoadingStats ? '-' : stats.activeCompetitions}
            icon={<Trophy className="h-4 w-4" />}
            isLoading={isLoadingStats}
             description="Currently running"
        />

      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Leaderboards - Still using mock data for now */}
        <Leaderboard title="Team Leaderboard (Weekly Mock)" entries={teamLeaderboardEntries} description="Overall Pod Rankings" />
        <Leaderboard title="Individual Leaderboard (Weekly Mock)" entries={individualLeaderboardEntries} description="Top Agent Performance" />
      </div>
       {/* Add Links to key actions */}
       {/*
       <div className="mt-6">
         <Card>
            <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
             <CardContent className="flex flex-wrap gap-4">
                <Button asChild>
                    <Link href="/admin/competitions">Manage Competitions</Link>
                </Button>
                <Button asChild variant="outline">
                    <Link href="/admin/users">Manage Users</Link>
                </Button>
                 <Button asChild variant="outline">
                    <Link href="/admin/log-achievements">Log Achievements</Link>
                 </Button>
             </CardContent>
         </Card>
       </div>
        */}
    </>
  );
}
