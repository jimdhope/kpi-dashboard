
// src/components/agent-sidebar-layout.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarFooter,
  SidebarContent,
  SidebarTrigger,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup, // Added import
  SidebarGroupLabel, // Added import
  SidebarSeparator, // Added import
} from '@/components/ui/sidebar';
import { Home, Settings, UserSquare, CheckSquare, Star, Swords, Trophy, UserCog, ExternalLink } from 'lucide-react'; // Added ExternalLink
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { app, db } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils';
import type { AppUser, UserRole } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { RoleSwitcher } from './role-switcher';
import { AppLogo } from './app-logo';
import type { DashboardSettingsData, Widget, ExternalLink as ExternalLinkType } from '@/app/(admin)/admin/message-of-the-day/page';


interface AgentSidebarLayoutProps {
  children: React.ReactNode;
  roles?: UserRole[]; // Make optional if ProfileLayout always provides it
  currentLayout?: 'admin' | 'agent' | null; // Make optional
  onLayoutChange?: (newLayout: 'admin' | 'agent') => void; // Make optional
}

export function AgentSidebarLayout({ children, roles = [], currentLayout = null, onLayoutChange }: AgentSidebarLayoutProps) {
  const currentPath = usePathname();
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettingsData | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const auth = getAuth(app);

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
            setCurrentUserData(null);
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

  useEffect(() => {
    setIsLoadingSettings(true);
    const settingsDocRef = doc(db, "settings", "agentDashboardSettings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setDashboardSettings(docSnap.data() as DashboardSettingsData);
      } else {
        setDashboardSettings(null); // No settings configured
      }
      setIsLoadingSettings(false);
    }, (error) => {
      console.error("Error fetching dashboard settings:", error);
      setIsLoadingSettings(false);
    });
    return () => unsubscribeSettings();
  }, []);

   const getInitials = (name?: string | null) => generateInitials(name || '');
   const hasAdminPrivileges = roles.includes('admin') || roles.includes('podManager') || roles.includes('teamLeader');

   // Memoize visible widgets and links
   const { visibleSidebarPages, externalLinksWidget } = useMemo(() => {
        if (!dashboardSettings) return { visibleSidebarPages: [], externalLinksWidget: null };
        
        const sidebarPages = dashboardSettings.widgets.filter(
            (w): w is Widget & { type: 'sidebar' } => w.type === 'sidebar' && w.isEnabled
        );

        const linksWidget = dashboardSettings.widgets.find(
            (w): w is Widget & { type: 'links' } => w.type === 'links' && w.isEnabled
        );

        return { visibleSidebarPages: sidebarPages, externalLinksWidget: linksWidget || null };
    }, [dashboardSettings]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex relative z-10 min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <AppLogo className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">KPI Quest</h1>
              <span className="text-xs text-muted-foreground ml-1">(Agent)</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="flex-1 overflow-y-auto p-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/agent" passHref>
                  <SidebarMenuButton tooltip="Dashboard" isActive={currentPath === '/agent'}>
                    <Home />
                    <span>My Dashboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              
               {visibleSidebarPages.map(page => {
                    const pageMap = {
                        'rps-game': { href: '/agent/rps-game', icon: <Swords />, label: 'RPS Game' },
                        'agent-guide': { href: '/guides/agent-guide', icon: <Star />, label: 'Agent Guide' },
                    };
                    const pageInfo = pageMap[page.id as keyof typeof pageMap];
                    if (!pageInfo) return null;
                    
                    return (
                         <SidebarMenuItem key={page.id}>
                            <Link href={pageInfo.href} passHref>
                            <SidebarMenuButton tooltip={pageInfo.label} isActive={currentPath === pageInfo.href}>
                                {pageInfo.icon}
                                <span>{pageInfo.label}</span>
                            </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    );
               })}

                {externalLinksWidget && externalLinksWidget.links && externalLinksWidget.links.length > 0 && (
                     <SidebarGroup>
                        <SidebarGroupLabel>External Links</SidebarGroupLabel>
                         {externalLinksWidget.links.map((link: ExternalLinkType) => (
                              <SidebarMenuItem key={link.id}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                  <SidebarMenuButton tooltip={link.title}>
                                    <ExternalLink />
                                    <span>{link.title}</span>
                                  </SidebarMenuButton>
                                </a>
                              </SidebarMenuItem>
                         ))}
                    </SidebarGroup>
                )}


                {hasAdminPrivileges && (
                    <>
                        <SidebarSeparator />
                        <SidebarMenuItem>
                            <Link href="/admin" passHref>
                                <SidebarMenuButton tooltip="Go to Admin Dashboard" isActive={currentPath.startsWith('/admin')}>
                                    <UserCog />
                                    <span>Admin Dashboard</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    </>
                )}
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
                <h2 className="text-lg font-semibold hidden md:block">My Dashboard</h2>
              </div>
              <div className="flex items-center gap-4">
                {onLayoutChange && roles && currentLayout && (
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
