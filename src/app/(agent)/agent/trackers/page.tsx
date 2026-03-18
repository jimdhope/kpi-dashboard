'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Trophy } from "lucide-react";
import { onSnapshot, doc, query, collection, where, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import type { AppUser } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { generateInitials } from '@/lib/utils';
import { format, startOfDay } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TrackerKpi {
  id: string;
  name: string;
  initials: string;
  type: string;
}

interface TrackerLog {
  id?: string;
  agentId: string;
  podId: string;
  trackerKpiId: string;
  date: any;
  value: number;
  loggedAt: any;
}

export default function AgentTrackersPage() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [trackerKpis, setTrackerKpis] = useState<TrackerKpi[]>([]);
  const [trackerLogs, setTrackerLogs] = useState<TrackerLog[]>([]);
  const [agents, setAgents] = useState<AppUser[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch user
  useEffect(() => {
    let mounted = true;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists() && mounted) {
              setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
            }
          });
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
      if (mounted) {
        setIsLoadingData(false);
      }
    });
    
    return () => {
      mounted = false;
      unsubscribeAuth();
    };
  }, []);

  // Fetch tracker KPIs
  useEffect(() => {
    const kpisQuery = query(collection(db, 'trackerKpis'), orderBy('name'));
    const unsubscribe = onSnapshot(kpisQuery, (snapshot) => {
      setTrackerKpis(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerKpi)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch all agents
  useEffect(() => {
    const agentsQuery = query(collection(db, 'users'), orderBy('name'));
    const unsubscribe = onSnapshot(agentsQuery, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    });
    return () => unsubscribe();
  }, []);

  // Fetch tracker logs for selected date
  useEffect(() => {
    setIsLoadingData(true);
    const dateTimestamp = { seconds: Math.floor(startOfDay(selectedDate).getTime() / 1000), nanoseconds: 0 };
    
    const logsQuery = query(
      collection(db, 'trackerLogs'),
      where('date', '==', dateTimestamp)
    );

    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setTrackerLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackerLog)));
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  // Calculate agent's tracker counts
  const agentTrackerCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    
    trackerLogs.forEach(log => {
      if (!counts[log.agentId]) {
        counts[log.agentId] = {};
      }
      if (!counts[log.agentId][log.trackerKpiId]) {
        counts[log.agentId][log.trackerKpiId] = 0;
      }
      counts[log.agentId][log.trackerKpiId] += log.value;
    });
    
    return counts;
  }, [trackerLogs]);

  // Calculate current user's tracker counts
  const userTrackerCounts = useMemo(() => {
    if (!currentUser?.id) return {};
    return agentTrackerCounts[currentUser.id] || {};
  }, [agentTrackerCounts, currentUser?.id]);

  // Calculate leaderboard data
  const leaderboardData = useMemo(() => {
    if (trackerKpis.length === 0) return [];
    
    // Get all agents who have any logs
    const agentIds = Object.keys(agentTrackerCounts);
    if (agentIds.length === 0) return [];

    return agentIds
      .map(agentId => {
        const agent = agents.find(a => a.id === agentId);
        const trackerValues: Record<string, number> = {};
        let total = 0;
        
        trackerKpis.forEach(kpi => {
          const value = agentTrackerCounts[agentId]?.[kpi.id] || 0;
          trackerValues[kpi.id] = value;
          total += value;
        });

        return {
          agentId,
          agentName: agent?.name || 'Unknown',
          trackerValues,
          total,
          isCurrentUser: agentId === currentUser?.id,
        };
      })
      .filter(entry => entry.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [trackerKpis, agentTrackerCounts, agents, currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trackers</h1>
          <p className="text-muted-foreground">Daily tracker counts and rankings</p>
        </div>
        
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[200px] justify-start text-left font-normal glass-input",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              fromDate={new Date('2024-01-01')}
              toDate={new Date()}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left - Your Rolling Trackers */}
        <Card variant="glass" className="lg:col-span-3">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Your Rolling Trackers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : trackerKpis.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No rolling trackers configured</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {trackerKpis
                  .map(kpi => ({
                    ...kpi,
                    count: userTrackerCounts[kpi.id] || 0,
                  }))
                  .sort((a, b) => b.count - a.count)
                  .map((kpi) => (
                    <div
                      key={kpi.id}
                      className="p-4 rounded-lg bg-glass/30 text-center border border-glass-border/20"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                        <span className="text-lg font-bold text-primary">{kpi.initials}</span>
                      </div>
                      <p className="font-medium text-sm mb-1 truncate" title={kpi.name}>{kpi.name}</p>
                      <p className="text-3xl font-bold text-primary">{kpi.count}</p>
                      <p className="text-xs text-muted-foreground">achieved</p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right - Tracker Leaderboard */}
        <Card variant="glass" className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Tracker Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : leaderboardData.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No entries for this date</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-glass-border/30">
                      <th className="text-left py-2 px-2 font-medium">#</th>
                      <th className="text-left py-2 px-2 font-medium">Agent</th>
                      {trackerKpis.slice(0, 3).map(kpi => (
                        <th key={kpi.id} className="text-center py-2 px-1 font-medium" title={kpi.name}>
                          {kpi.initials}
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardData.map((entry, index) => (
                      <tr
                        key={entry.agentId}
                        className={`border-b border-glass-border/20 ${
                          entry.isCurrentUser ? 'bg-primary/10' : index % 2 === 0 ? 'bg-glass/10' : ''
                        }`}
                      >
                        <td className="py-2 px-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            index === 0 ? 'bg-yellow-500/30 text-yellow-400' :
                            index === 1 ? 'bg-gray-400/30 text-gray-300' :
                            index === 2 ? 'bg-orange-400/30 text-orange-400' :
                            'bg-glass text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {generateInitials(entry.agentName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[100px]">
                              {entry.agentName.split(' ')[0]}
                              {entry.isCurrentUser && ' (You)'}
                            </span>
                          </div>
                        </td>
                        {trackerKpis.slice(0, 3).map(kpi => (
                          <td key={kpi.id} className="text-center py-2 px-1">
                            {entry.trackerValues[kpi.id] || '-'}
                          </td>
                        ))}
                        <td className={`text-right py-2 px-2 font-bold ${entry.isCurrentUser ? 'text-primary' : ''}`}>
                          {entry.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Calendar Icon component
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
