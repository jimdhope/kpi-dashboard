'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { Settings as SettingsIcon, Megaphone, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import type { AppUser, UserRole } from '@/services/user';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  label: string;
  href: string;
  icon: typeof SettingsIcon;
}

const settingsMenuItems: MenuItem[] = [
  { label: 'General', href: '/settings/general', icon: SettingsIcon },
  { label: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
  { label: 'Pods', href: '/settings/pods', icon: ShieldCheck },
  { label: 'Users', href: '/settings/users', icon: Users },
];

const rolesWithSettingsAccess: UserRole[] = [
  'admin',
  'campaignManager',
  'podManager',
  'teamLeader',
  'competitionRunner',
];

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(getAuth(app), (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
          setIsLoading(false);
        });
        return () => unsubscribeUser();
      } else {
        setCurrentUser(null);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!isLoading && pathname === '/settings') {
      router.replace('/settings/general');
    }
  }, [isLoading, pathname, router]);

  const userRoles = currentUser?.roles as UserRole[] || [];
  const hasSettingsAccess = userRoles.some(role => rolesWithSettingsAccess.includes(role));

  const isActive = (href: string) => {
    return pathname.startsWith(href);
  };

  if (isLoading) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="flex relative min-h-screen w-full flex-col">
          <div className="flex flex-1">
            <Sidebar className="glass-sidebar border-r border-glass-border/40 pt-0 top-[65px] h-[calc(100vh-65px)]">
              <SidebarContent className="pt-4">
                <div className="px-4 mb-4">
                  <Skeleton className="h-4 w-20" />
                </div>
                <SidebarMenu>
                  {[1, 2, 3].map(i => (
                    <SidebarMenuItem key={i}>
                      <Skeleton className="h-10 w-full mx-2" />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarContent>
            </Sidebar>
            <main className="flex-1 p-6 overflow-y-auto min-h-[calc(100vh-65px)]">
              <Skeleton className="h-64 w-full" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!hasSettingsAccess) {
    return (
      <SidebarProvider defaultOpen={true}>
        <div className="flex relative min-h-screen w-full flex-col">
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">You do not have access to settings.</p>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex relative min-h-screen w-full flex-col">
        <div className="flex flex-1">
          <Sidebar className="glass-sidebar border-r border-glass-border/40 pt-0 top-[65px] h-[calc(100vh-65px)]">
            <SidebarContent className="pt-4">
              <div className="px-4 mb-4">
                <h3 className="text-sm font-semibold">Settings</h3>
              </div>
              <SidebarMenu>
                {settingsMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <Link href={item.href}>
                        <SidebarMenuButton 
                          isActive={active}
                          className={cn(
                            "mb-1",
                            active && "bg-primary/20 text-primary border-l-2 border-primary"
                          )}
                        >
                          <Icon className={cn("w-4 h-4", active ? "text-primary" : "")} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </Link>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 p-6 overflow-y-auto min-h-[calc(100vh-65px)]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
