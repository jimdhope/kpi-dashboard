
// src/components/agent-sidebar-layout.tsx
'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  SidebarGroup, // Added import
  SidebarGroupLabel, // Added import
  SidebarSeparator, // Added import
} from '@/components/ui/sidebar';
import { Home, Settings, UserSquare, CheckSquare, Star, ClipboardList, Target, Swords, Trophy } from 'lucide-react'; // Added Trophy
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { app, db } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils';
import type { AppUser, UserRole } from '@/services/user';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RoleSwitcher } from './role-switcher';
import { AppLogo } from './app-logo';
import { AnimatedSvgBackground } from './animated-svg-background'; // Import the animated background

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
  const auth = getAuth(app);

    useEffect(() => {
        console.log("[AgentSidebarLayout] Received props:", { roles, currentLayout });
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
      {/* Fixed Background Container */}
      <div className="fixed-background-container">
        <AnimatedSvgBackground />
      </div>

      {/* Container for Sidebar and Main Area (Header + Content) */}
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
               <SidebarMenuItem>
                <Link href="/agent/leaderboard" passHref>
                  <SidebarMenuButton tooltip="Leaderboard" isActive={currentPath === '/agent/leaderboard'}>
                    <Trophy />
                    <span>Leaderboard</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/agent/rps-game" passHref>
                  <SidebarMenuButton tooltip="Rock Paper Scissors" isActive={currentPath === '/agent/rps-game'}>
                    <Swords />
                    <span>RPS Game</span>
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

        {/* Main Area: Header + Scrollable Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background/90 backdrop-blur-sm md:px-6 w-full">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
                <h2 className="text-lg font-semibold hidden md:block">My Dashboard</h2>
              </div>
              <div className="flex items-center gap-4">
                {onLayoutChange && roles && currentLayout && ( // Check if props are valid
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
          {/* Scrollable Main Content */}
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
