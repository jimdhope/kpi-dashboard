'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Target, BarChart3, Users, Gamepad2, Bell, Settings, Loader2 } from 'lucide-react';

interface DashboardStats {
  competitions: number;
  activeCompetitions: number;
  pods: number;
  agents: number;
  todayLogs: number;
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ name: string; email: string; roles: string[] } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    competitions: 0,
    activeCompetitions: 0,
    pods: 0,
    agents: 0,
    todayLogs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch session
        const sessionRes = await fetch('/api/auth/session');
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.authenticated) {
            setUser(sessionData.user);
          }
        }

        // Fetch competitions
        const compsRes = await fetch('/api/competitions');
        if (compsRes.ok) {
          const compsData = await compsRes.json();
          const competitions = compsData.competitions || [];
          const now = new Date();
          const active = competitions.filter((c: any) => {
            const start = c.startsAt ? new Date(c.startsAt) : null;
            const end = c.endsAt ? new Date(c.endsAt) : null;
            return start && end && start <= now && end >= now;
          });
          setStats(prev => ({ ...prev, competitions: competitions.length, activeCompetitions: active.length }));
        }

        // Fetch pods
        const podsRes = await fetch('/api/pods');
        if (podsRes.ok) {
          const podsData = await podsRes.json();
          setStats(prev => ({ ...prev, pods: (podsData.pods || podsData || []).length }));
        }

        // Fetch users
        const usersRes = await fetch('/api/users');
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setStats(prev => ({ ...prev, agents: (usersData.users || usersData || []).length }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const quickLinks = [
    { title: 'Competitions', href: '/competitions', icon: Trophy, description: 'View and manage competitions' },
    { title: 'Trackers', href: '/trackers', icon: Target, description: 'Log daily KPI tracking' },
    { title: 'Performance', href: '/performance', icon: BarChart3, description: 'View performance analytics' },
    { title: 'Reports', href: '/reports', icon: BarChart3, description: 'Generate reports' },
    { title: 'Mini Games', href: '/mini-games', icon: Gamepad2, description: 'Play RPS and more' },
    { title: 'Settings', href: '/settings', icon: Settings, description: 'Configure your account' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h1>
        <p className="text-muted-foreground">Here's what's happening with your team today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Competitions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.competitions}</div>
            <p className="text-xs text-muted-foreground">{stats.activeCompetitions} active now</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pods</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pods}</div>
            <p className="text-xs text-muted-foreground">Active pods</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.agents}</div>
            <p className="text-xs text-muted-foreground">Team members</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Logs</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayLogs}</div>
            <p className="text-xs text-muted-foreground">Tracker entries today</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="glass-card hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{link.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
