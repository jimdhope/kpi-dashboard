'use client'; // Add 'use client' directive
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import Link from 'next/link'; // Import Link
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator, // Import Separator
} from '@/components/ui/sidebar';
import { Home, Users, BarChart3, Settings, Trophy, Megaphone, ShieldCheck, UsersRound, Award, CheckSquare, Star, ClipboardList, Target } from 'lucide-react'; // Added Target icon
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; // Removed AvatarImage import
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button'; // Import Button
import { getAuth, onAuthStateChanged, User } from 'firebase/auth'; // Import Firebase Auth
import { doc, getDoc, onSnapshot } from "firebase/firestore"; // Import Firestore
import { app, db } from '@/lib/firebase'; // Import Firebase app and db
import { generateInitials } from '@/lib/utils'; // Import generateInitials
import type { AppUser } from '@/services/user'; // Import AppUser type
import { Skeleton } from '@/components/ui/skeleton'; // Import Skeleton

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const currentPath = usePathname(); // Get current route
  const [currentUserData, setCurrentUserData] = useState<AppUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
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
            // Set minimal data from auth if Firestore doc missing
            setCurrentUserData({
                id: user.uid,
                uid: user.uid,
                name: user.displayName || user.email || 'User',
                email: user.email || '',
                roles: [], // Default to no roles
                podId: null,
                 // Ensure optional avatar fields exist or are initialized
                 avatarUrl: '',
                 avatarInitials: '',
                 avatarBgColor: '',
            });
          }
          setIsLoadingUser(false);
        }, (error) => {
          console.error("Error fetching user document:", error);
          setCurrentUserData(null); // Clear data on error
          setIsLoadingUser(false);
        });
      } else {
        // No user logged in
        setCurrentUserData(null);
        setIsLoadingUser(false);
        // Redirect handled by ProfileLayout
      }
      // Return the cleanup function for the Firestore listener
      return () => {
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
        }
      };
    });

    // Return the cleanup function for the auth listener
    return () => unsubscribeAuth();
  }, [auth]);

  const getInitials = (name?: string | null) => generateInitials(name || '');
  const bgColor = currentUserData?.avatarBgColor || undefined; // Use explicit undefined for random color generation

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-primary">
              <path fillRule="evenodd" d="M2.25 13.5a8.25 8.25 0 018.25-8.25.75.75 0 01.75.75v6.75H18a.75.75 0 01.75.75 8.25 8.25 0 01-16.5 0z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M12.75 3a.75.75 0 01.75-.75 8.25 8.25 0 018.25 8.25.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75V3z" clipRule="evenodd" />
            </svg>
            <h1 className="text-xl font-semibold">KpiQuest</h1>
             <span className="text-xs text-muted-foreground ml-1">(Admin)</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="flex-1 overflow-y-auto p-4">
          <SidebarMenu>
            {/* Dashboard */}
            <SidebarMenuItem>
              <Link href="/admin" passHref>
                <SidebarMenuButton tooltip="Dashboard" isActive={currentPath === '/admin'}>
                  <Home />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>

             {/* Logging & Scores */}
              <SidebarGroup>
                  <SidebarGroupLabel>Daily Data</SidebarGroupLabel>
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
                        <Link href="/admin/leaderboard" passHref>
                        <SidebarMenuButton tooltip="Leaderboard" isActive={currentPath === '/admin/leaderboard'}>
                            <Star />
                            <span>Leaderboard</span>
                        </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
              </SidebarGroup>


            {/* Competitions Section */}
             <SidebarGroup>
              <SidebarGroupLabel>Competitions</SidebarGroupLabel>
               <SidebarMenuItem>
                 <Link href="/admin/competitions" passHref>
                    <SidebarMenuButton tooltip="Competitions" isActive={currentPath === '/admin/competitions'}>
                      <Trophy />
                      <span>Competitions</span>
                    </SidebarMenuButton>
                   </Link>
              </SidebarMenuItem>
              {/* New Pod Daily Targets Link */}
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
            </SidebarGroup>

             {/* Management Section */}
            <SidebarGroup>
              <SidebarGroupLabel>Management</SidebarGroupLabel>
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
            </SidebarGroup>

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
                       {/* Always use Fallback */}
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
      <SidebarInset className="flex flex-col">
         <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 border-b bg-background md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              {/* TODO: Make header title dynamic */}
              <h2 className="text-lg font-semibold hidden md:block">Admin Dashboard</h2>
            </div>
            <div className="flex items-center gap-4">
               <ThemeToggle />
                 <Button variant="outline" size="sm" onClick={() => getAuth(app).signOut().then(() => window.location.href = '/login')}>Logout</Button>
            </div>
          </header>
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
