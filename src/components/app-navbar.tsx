'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trophy, Target, BarChart3, Gamepad2, User, ChevronDown, Shield, Megaphone, Crown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AppUser, UserRole } from '@/services/user';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  key: string;
  label: string;
  adminHref: string;
  agentHref: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { key: 'competitions', label: 'Competitions', adminHref: '/competitions', agentHref: '/agent/competitions', icon: Trophy },
  { key: 'trackers', label: 'Trackers', adminHref: '/trackers', agentHref: '/agent/trackers', icon: Target },
  { key: 'performance', label: 'Performance', adminHref: '/performance', agentHref: '/agent/performance', icon: BarChart3 },
  { key: 'miniGames', label: 'Mini Games', adminHref: '/mini-games', agentHref: '/agent/mini-games', icon: Gamepad2 },
];

const rolePermissions: Record<UserRole, Record<string, 'admin' | 'agent' | 'none'>> = {
  admin: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    miniGames: 'admin',
  },
  campaignManager: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    miniGames: 'admin',
  },
  podManager: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    miniGames: 'admin',
  },
  teamLeader: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'agent',
    miniGames: 'agent',
  },
  competitionRunner: {
    competitions: 'admin',
    trackers: 'agent',
    performance: 'agent',
    miniGames: 'agent',
  },
  agent: {
    competitions: 'agent',
    trackers: 'agent',
    performance: 'agent',
    miniGames: 'agent',
  },
};

const roleDashboardHrefs: Record<UserRole, string> = {
  admin: '/admin',
  campaignManager: '/campaign-manager',
  podManager: '/pod-manager',
  teamLeader: '/team-leader',
  competitionRunner: '/competition-runner',
  agent: '/agent',
};

const roleDashboardLabels: Record<UserRole, string> = {
  admin: 'Dashboard',
  campaignManager: 'Dashboard',
  podManager: 'Dashboard',
  teamLeader: 'Dashboard',
  competitionRunner: 'Dashboard',
  agent: 'My Dashboard',
};

const roleIcons: Record<UserRole, React.ElementType> = {
  admin: Shield,
  campaignManager: Megaphone,
  podManager: Crown,
  teamLeader: Activity,
  competitionRunner: Trophy,
  agent: User,
};

const rolePriority: UserRole[] = [
  'admin',
  'campaignManager',
  'podManager',
  'teamLeader',
  'competitionRunner',
  'agent',
];

const rolesWithSettingsAccess: UserRole[] = [
  'admin',
  'campaignManager',
  'podManager',
  'teamLeader',
  'competitionRunner',
];

export function AppNavBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);

  React.useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setCurrentUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const userRoles = currentUser?.roles as UserRole[] || [];

  const getHighestRole = (): UserRole => {
    for (const role of rolePriority) {
      if (userRoles.includes(role)) {
        return role;
      }
    }
    return 'agent';
  };

  const primaryRole = getHighestRole();

  const getHighestAccess = (key: string): 'admin' | 'agent' | 'none' => {
    let highest: 'admin' | 'agent' | 'none' = 'none';
    
    for (const role of userRoles) {
      const permission = rolePermissions[role]?.[key];
      if (permission === 'admin') {
        return 'admin';
      }
      if (permission === 'agent') {
        highest = 'agent';
      }
    }
    
    return highest;
  };

  const getNavHref = (item: NavItem): string | null => {
    const access = getHighestAccess(item.key);
    if (access === 'none') return null;
    return access === 'admin' ? item.adminHref : item.agentHref;
  };

  const visibleNavItems = navItems.filter(item => getNavHref(item) !== null);

  const dashboardHref = roleDashboardHrefs[primaryRole];
  const dashboardLabel = roleDashboardLabels[primaryRole];
  const RoleIcon = roleIcons[primaryRole];

  const hasSettingsAccess = userRoles.some(role => rolesWithSettingsAccess.includes(role));

  const handleLogout = async () => {
    const auth = getAuth(app);
    await auth.signOut();
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    if (href === '/competitions') {
      return pathname.startsWith('/competitions');
    }
    if (href === '/agent/competitions') {
      return pathname.startsWith('/agent/competitions');
    }
    return pathname.startsWith(href);
  };

  if (!currentUser) {
    return null;
  }

  return (
    <nav className={cn("glass-sidebar sticky top-0 z-50 flex items-center justify-between px-6 py-3", className)}>
      <div className="flex items-center gap-2">
        <Link href={dashboardHref} className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">KPI Quest</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link href={dashboardHref}>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                isActive(dashboardHref) 
                  ? "bg-primary/20 text-primary border border-primary/30" 
                  : "text-muted-foreground hover:text-foreground hover:bg-glass/50"
              )}
            >
              <RoleIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{dashboardLabel}</span>
            </Button>
          </Link>

          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const href = getNavHref(item);
            if (!href) return null;
            const active = isActive(href);
            return (
              <Link key={item.key} href={href}>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200",
                    active 
                      ? "bg-primary/20 text-primary border border-primary/30" 
                      : "text-muted-foreground hover:text-foreground hover:bg-glass/50"
                  )}
                >
                  <Icon className={cn("w-4 h-4", active ? "text-primary" : "")} />
                  <span className="text-sm font-medium">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto rounded-lg">
                <Avatar className="w-8 h-8 border-2 border-glass-border">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {generateInitials(currentUser.name || currentUser.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium leading-none">{currentUser.name || currentUser.email}</p>
                  <p className="text-xs text-muted-foreground capitalize leading-none mt-0.5">{primaryRole.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/agent/profile" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              {hasSettingsAccess && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
