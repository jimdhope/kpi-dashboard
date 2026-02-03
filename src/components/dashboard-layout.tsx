// src/components/dashboard-layout.tsx
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; // Keep usePathname
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Home, Users, Settings, Trophy, Megaphone, ShieldCheck, UsersRound, Award, CheckSquare, Star, ClipboardList, Target, UserSquare, FileText, MessageSquare, Swords, Database, BarChartHorizontal, LineChart, GanttChartSquare } from 'lucide-react'; // Added GanttChartSquare
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button'; // Import Button
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { app, db } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils';
import type { AppUser, UserRole } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RoleSwitcher } from './role-switcher';
import { AppLogo } from './app-logo';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


interface DashboardLayoutProps {
  children: React.ReactNode;
  roles?: UserRole[];
  currentLayout?: 'admin' | 'agent' | null;
  onLayoutChange?: (newLayout: 'admin' | 'agent') => void;
}

export function DashboardLayout({ children, roles = [], currentLayout = null, onLayoutChange }: DashboardLayoutProps) {
  const currentPath = usePathname();
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const auth = getAuth(app);

  useEffect(() => {
    console.log("[DashboardLayout] Received props:", { roles, currentLayout });
  }, [roles, currentLayout]);


  useEffect(() => {
    setIsLoadingUser(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      let unsubscribeUserDoc: (() => void) | undefined = undefined;
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUserData({ id: docSnap.id, ...docSnap.data() } as AppUser);
          } else {
            console.warn(`Firestore document for user ${user.uid} not found.`);
            setCurrentUserData({
                id: user.uid,
                uid: user.uid,
                name: user.displayName || user.email || 'User',
                email: user.email || '',
                roles: [],
                podId: null,
                 avatarUrl: '',
                 avatarInitials: '',
                 avatarBgColor: '',
            });
          }
          setIsLoadingUser(false);
        }, (error) => {
          console.error("Error fetching user document:", error);
          setCurrentUserData(null);
          setIsLoadingUser(false);
        });
      } else {
        setCurrentUserData(null);
        setIsLoadingUser(false);
      }
       return () => {
         if (unsubscribeUserDoc) {
           unsubscribeUserDoc();
         }
       };
    });
    return () => unsubscribeAuth();
  }, [auth]);

  const getInitials = (name?: string | null) => generateInitials(name || '');

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex relative z-10 min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <AppLogo className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">KPI Quest</h1>
              <span className="text-xs text-muted-foreground ml-1">(Admin)</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="flex-1 overflow-y-auto p-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/admin" passHref>
                  <SidebarMenuButton tooltip="Dashboard" isActive={currentPath === '/admin'}>
                    <Home />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
            
            <Accordion type="multiple" defaultValue={['analysis', 'daily-data', 'competitions', 'performance', 'management', 'trackers']} className="w-full">

                <AccordionItem value="analysis" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                        Analysis
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <Link href="/admin/stats" passHref>
                                    <SidebarMenuButton tooltip="Stats" isActive={currentPath.startsWith('/admin/stats')}>
                                        <GanttChartSquare />
                                        <span>Stats</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="daily-data" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                       Daily Data
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <Link href="/admin/log-achievements" passHref>
                                    <SidebarMenuButton tooltip="Log Achievements" isActive={currentPath === '/admin/log-achievements'}>
                                    <CheckSquare />
                                    <span>Log Achievements</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/daily-scores" passHref>
                                <SidebarMenuButton tooltip="Daily Scores" isActive={currentPath === '/admin/daily-scores'}>
                                    <ClipboardList />
                                    <span>Daily Scores</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/rps-scores" passHref>
                                <SidebarMenuButton tooltip="RPS Scores" isActive={currentPath === '/admin/rps-scores'}>
                                    <Swords />
                                    <span>RPS Scores</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="competitions" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                       Competitions
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                             <SidebarMenuItem>
                                <Link href="/admin/competitions" passHref>
                                    <SidebarMenuButton tooltip="Competitions" isActive={currentPath.startsWith('/admin/competitions')}>
                                        <Trophy />
                                        <span>Competitions</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/pod-targets" passHref>
                                <SidebarMenuButton tooltip="Pod Daily Targets" isActive={currentPath === '/admin/pod-targets'}>
                                    <Target />
                                    <span>Pod Targets</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/teams" passHref>
                                    <SidebarMenuButton tooltip="Teams" isActive={currentPath === '/admin/teams'}>
                                        <Users />
                                        <span>Teams</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/leaderboard" passHref>
                                <SidebarMenuButton tooltip="Competition Leaderboard" isActive={currentPath === '/admin/leaderboard'}>
                                    <Star />
                                    <span>Leaderboard</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/certificates" passHref>
                                <SidebarMenuButton tooltip="Generate Certificates" isActive={currentPath === '/admin/certificates'}>
                                    <Award />
                                    <span>Certificates</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>

                 <AccordionItem value="performance" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                       Performance
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                             <SidebarMenuItem>
                                <Link href="/admin/additional-kpis" passHref>
                                    <SidebarMenuButton tooltip="Setup Additional KPIs" isActive={currentPath.startsWith('/admin/additional-kpis')}>
                                        <Settings />
                                        <span>Setup KPIs</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/additional-scores" passHref>
                                    <SidebarMenuButton tooltip="Log Additional Scores" isActive={currentPath.startsWith('/admin/additional-scores')}>
                                        <CheckSquare />
                                        <span>Log Scores</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/additional-leaderboard" passHref>
                                    <SidebarMenuButton tooltip="Additional Leaderboard" isActive={currentPath.startsWith('/admin/additional-leaderboard')}>
                                        <Star />
                                        <span>Leaderboard</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/kpi-breakdown" passHref>
                                    <SidebarMenuButton tooltip="KPI Breakdown" isActive={currentPath.startsWith('/admin/kpi-breakdown')}>
                                        <BarChartHorizontal />
                                        <span>KPI Breakdown</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/performance-charts" passHref>
                                    <SidebarMenuButton tooltip="Performance Charts" isActive={currentPath.startsWith('/admin/performance-charts')}>
                                        <LineChart />
                                        <span>Performance Charts</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="trackers" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                       Trackers
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <Link href="/admin/trackers/setup" passHref>
                                    <SidebarMenuButton tooltip="Setup Tracker" isActive={currentPath.startsWith('/admin/trackers/setup')}>
                                        <Settings />
                                        <span>Setup Tracker</span>
                                    </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="management" className="border-none">
                    <AccordionTrigger className="py-2 px-2 text-xs font-medium uppercase text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md">
                       Management
                    </AccordionTrigger>
                    <AccordionContent className="pl-4 pt-1 pb-0">
                        <SidebarMenu>
                           <SidebarMenuItem>
                            <Link href="/admin/campaigns" passHref>
                                <SidebarMenuButton tooltip="Campaigns" isActive={currentPath === '/admin/campaigns'}>
                                    <Megaphone />
                                    <span>Campaigns</span>
                                </SidebarMenuButton>
                            </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                            <Link href="/admin/pods" passHref>
                                <SidebarMenuButton tooltip="Pods" isActive={currentPath === '/admin/pods'}>
                                    <ShieldCheck />
                                    <span>Pods</span>
                                </SidebarMenuButton>
                                </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <Link href="/admin/users" passHref>
                                <SidebarMenuButton tooltip="Users" isActive={currentPath === '/admin/users'}>
                                    <UsersRound />
                                    <span>Users</span>
                                </SidebarMenuButton>
                            </Link>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                            <Link href="/admin/message-of-the-day" passHref>
                                <SidebarMenuButton tooltip="Dashboard Settings" isActive={currentPath === '/admin/message-of-the-day'}>
                                <Settings />
                                <span>Dashboard Settings</span>
                                </SidebarMenuButton>
                            </Link>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </AccordionContent>
                </AccordionItem>

            </Accordion>


            <SidebarMenu>
                <SidebarSeparator />
                <SidebarMenuItem>
                    <Link href="/agent" passHref>
                        <SidebarMenuButton tooltip="View Agent Dashboard" isActive={currentPath.startsWith('/agent')}>
                            <UserSquare />
                            <span>View Agent Dashboard</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
             </SidebarMenu>

          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3">
              {isLoadingUser ? (
                  <>
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex-1 space-y-1">
                          <Skeleton className="h-4 w-20 rounded" />
                          <Skeleton className="h-3 w-32 rounded" />
                      </div>
                      <Skeleton className="h-7 w-7 rounded" />
                  </>
              ) : currentUserData ? (
                  <>
                      <Avatar className="h-9 w-9">
                        <AvatarFallback
                            initials={currentUserData.avatarInitials || getInitials(currentUserData.name)}
                            backgroundColor={currentUserData.avatarBgColor}
                          >
                            {!currentUserData.avatarInitials && getInitials(currentUserData.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{currentUserData.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{currentUserData.email}</p>
                      </div>
                      <Link href="/profile" passHref>
                          <SidebarMenuButton tooltip="Settings" size="sm" variant="ghost" className="ml-auto" isActive={currentPath === '/profile'}>
                              <Settings />
                          </SidebarMenuButton>
                      </Link>
                  </>
              ) : (
                  <div className="text-xs text-muted-foreground">Not logged in</div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background/90 backdrop-blur-sm md:px-6 w-full">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <h2 className="text-lg font-semibold hidden md:block">Admin Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
              {onLayoutChange && Array.isArray(roles) && roles.length > 0 && currentLayout && (
                <RoleSwitcher
                    availableRoles={roles}
                    currentLayout={currentLayout}
                    onLayoutChange={onLayoutChange}
                />
              )}
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => getAuth(app).signOut().then(() => window.location.href = '/login')}>Logout</Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
