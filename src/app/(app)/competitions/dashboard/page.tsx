'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Target, Award, CheckSquare, TrendingUp, Calendar } from "lucide-react";
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Competition {
  id: string;
  name: string;
  startDate?: any;
  endDate?: any;
  status?: string;
}

interface Pod {
  id: string;
  name: string;
}

interface AppUser {
  id: string;
  name?: string;
  email?: string;
}

interface AchievementLog {
  id: string;
  agentId?: string;
  podId?: string;
}

export default function CompetitionsDashboard() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [achievementLogs, setAchievementLogs] = useState<AchievementLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch competitions
        const competitionsQuery = query(collection(db, 'competitions'), orderBy('startDate', 'desc'));
        unsubscribes.push(onSnapshot(competitionsQuery, (snapshot) => {
          if (isMounted) {
            setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Competition)));
          }
        }));

        // Fetch pods
        const podsQuery = query(collection(db, 'pods'), orderBy('name'));
        unsubscribes.push(onSnapshot(podsQuery, (snapshot) => {
          if (isMounted) {
            setPods(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pod)));
          }
        }));

        // Fetch users
        const usersQuery = query(collection(db, 'users'), orderBy('name'));
        unsubscribes.push(onSnapshot(usersQuery, (snapshot) => {
          if (isMounted) {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
          }
        }));

        // Fetch achievement logs
        const logsQuery = query(collection(db, 'dailyAchievements'), orderBy('date', 'desc'));
        unsubscribes.push(onSnapshot(logsQuery, (snapshot) => {
          if (isMounted) {
            setAchievementLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AchievementLog)));
            setIsLoading(false);
          }
        }));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const activeCompetitions = competitions.filter(c => c.status === 'active' || !c.status).length;
  const totalAchievements = achievementLogs.length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="glass">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-3 w-20 mt-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competitions Dashboard</h1>
          <p className="text-muted-foreground">Overview of your KPI competitions</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCompetitions}</div>
            <p className="text-xs text-muted-foreground">{competitions.length} total competitions</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pods</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pods.length}</div>
            <p className="text-xs text-muted-foreground">Working pods</p>
          </CardContent>
        </Card>
        <Card variant="glass" className="glass-card-hover">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievements Logged</CardTitle>
            <Award className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAchievements}</div>
            <p className="text-xs text-muted-foreground">Total entries</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card variant="glass" className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Competitions</CardTitle>
            <CardDescription>Latest competition entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {competitions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No competitions found</p>
              ) : (
                competitions.slice(0, 5).map((competition) => (
                  <div key={competition.id} className="flex items-center p-3 rounded-lg bg-glass/30">
                    <Trophy className="h-8 w-8 mr-3 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{competition.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {competition.startDate?.toDate ? format(competition.startDate.toDate(), 'MMM d, yyyy') : 'No start date'}
                        {competition.endDate?.toDate && ` - ${format(competition.endDate.toDate(), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      competition.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20 text-gray-500'
                    }`}>
                      {competition.status || 'active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        <Card variant="glass" className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigate to competitions sections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <a href="/competitions/log" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  <p className="text-sm font-medium">Log Achievements</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Record daily achievements</p>
              </a>
              <a href="/competitions/scores" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <p className="text-sm font-medium">Daily Scores</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">View team scores</p>
              </a>
              <a href="/competitions/leaderboard" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <p className="text-sm font-medium">Leaderboard</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">View rankings</p>
              </a>
              <a href="/competitions/setup" className="block p-3 rounded-lg bg-glass/30 hover:bg-glass/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <p className="text-sm font-medium">Setup Competition</p>
                </div>
                <p className="text-xs text-muted-foreground ml-6">Create new competition</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
