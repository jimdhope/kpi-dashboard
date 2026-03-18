'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, BarChart3, Gamepad2, Users, Settings, Megaphone, ShieldCheck, MessageSquare, ArrowRight } from "lucide-react";
import { collection, query, orderBy, getCountFromServer, doc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInitials } from '@/lib/utils';
import type { AppUser } from '@/services/user';

interface DashboardStats {
  competitions: number;
  trackers: number;
  performanceKpis: number;
  users: number;
  pods: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    competitions: 0,
    trackers: 0,
    performanceKpis: 0,
    users: 0,
    pods: 0,
  });
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    let isMounted = true;

    const fetchData = async () => {
      try {
        // Fetch competitions count
        const competitionsQuery = query(collection(db, 'competitions'));
        const competitionsSnap = await getCountFromServer(competitionsQuery);
        
        // Fetch tracker KPIs count
        const trackersQuery = query(collection(db, 'trackerKpis'));
        const trackersSnap = await getCountFromServer(trackersQuery);
        
        // Fetch performance KPIs count
        const kpisQuery = query(collection(db, 'additionalKpis'));
        const kpisSnap = await getCountFromServer(kpisQuery);
        
        // Fetch users count
        const usersQuery = query(collection(db, 'users'));
        const usersSnap = await getCountFromServer(usersQuery);
        
        // Fetch pods count
        const podsQuery = query(collection(db, 'pods'));
        const podsSnap = await getCountFromServer(podsQuery);

        if (isMounted) {
          setStats({
            competitions: competitionsSnap.data().count,
            trackers: trackersSnap.data().count,
            performanceKpis: kpisSnap.data().count,
            users: usersSnap.data().count,
            pods: podsSnap.data().count,
          });
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        setIsLoading(false);
      }
    };

    // Fetch current user
    const auth = getAuth();
    const userUnsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
        });
      }
    });
    unsubscribes.push(userUnsubscribe);

    fetchData();

    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, []);

  const miniApps = [
    {
      title: 'Competitions',
      description: 'KPI competitions, achievements, and leaderboards',
      href: '/competitions',
      icon: Trophy,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
      stats: stats.competitions,
      statsLabel: 'Active Competitions',
    },
    {
      title: 'Trackers',
      description: 'Campaign-wide tracking and monitoring',
      href: '/trackers',
      icon: Target,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      stats: stats.trackers,
      statsLabel: 'Active Trackers',
    },
    {
      title: 'Performance',
      description: 'KPI performance analytics and charts',
      href: '/performance',
      icon: BarChart3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      stats: stats.performanceKpis,
      statsLabel: 'KPIs Tracked',
    },
    {
      title: 'Mini Games',
      description: 'Fun activities and games',
      href: '/mini-games',
      icon: Gamepad2,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      stats: null,
      statsLabel: null,
    },
  ];

  const managementLinks = [
    { title: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
    { title: 'Pods', href: '/settings/pods', icon: ShieldCheck },
    { title: 'Users', href: '/settings/users', icon: Users },
    { title: 'Dashboard Settings', href: '/settings/dashboard', icon: MessageSquare },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of all KPI Quest applications</p>
      </div>

      {/* Mini Apps Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Applications</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {miniApps.map((app) => {
            const Icon = app.icon;
            return (
              <Link key={app.href} href={app.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className={`p-2 rounded-lg ${app.bgColor}`}>
                      <Icon className={`h-5 w-5 ${app.color}`} />
                    </div>
                    {app.stats !== null && (
                      <span className="text-2xl font-bold">{app.stats}</span>
                    )}
                  </CardHeader>
                  <CardContent>
                    <CardTitle className="text-lg">{app.title}</CardTitle>
                    <CardDescription className="mt-1">{app.description}</CardDescription>
                    {app.statsLabel && (
                      <p className="text-xs text-muted-foreground mt-2">{app.statsLabel}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.users}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Pods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.pods}</div>
            <p className="text-xs text-muted-foreground">Active pods</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-lg font-medium">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground">All services running</p>
          </CardContent>
        </Card>
      </div>

      {/* Management Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Management</h2>
          <Link href="/settings" className="text-sm text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {managementLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card variant="glass" className="glass-card-hover h-full cursor-pointer">
                  <CardContent className="flex items-center p-4">
                    <Icon className="h-5 w-5 mr-3 text-muted-foreground" />
                    <span className="font-medium">{link.title}</span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/competitions/log">
            <Card variant="glass" className="glass-card-hover cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Log Achievement</p>
                <p className="text-xs text-muted-foreground">Record a new achievement</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/competitions/setup">
            <Card variant="glass" className="glass-card-hover cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Create Competition</p>
                <p className="text-xs text-muted-foreground">Set up a new competition</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/trackers/setup">
            <Card variant="glass" className="glass-card-hover cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Setup Tracker</p>
                <p className="text-xs text-muted-foreground">Create a new tracker</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/performance/kpis">
            <Card variant="glass" className="glass-card-hover cursor-pointer">
              <CardContent className="p-4">
                <p className="font-medium">Add KPI</p>
                <p className="text-xs text-muted-foreground">Configure a new KPI</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
