'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Trophy, Target, BarChart3, Gamepad2, Settings, ChevronDown, User, Shield, Users, Crown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { generateInitials } from '@/lib/utils';
import type { AppUser } from '@/services/user';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AppType = 'competitions' | 'trackers' | 'performance' | 'mini-games' | 'settings';

interface RoleView {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

const roleViews: RoleView[] = [
  { id: 'admin', label: 'Admin', href: '/admin', icon: Shield, description: 'Full system access' },
  { id: 'agent', label: 'Agent', href: '/agent', icon: User, description: 'Personal dashboard' },
  { id: 'podSupport', label: 'Pod Support', href: '/pod-support', icon: Users, description: 'Support pod members' },
  { id: 'podManager', label: 'Pod Manager', href: '/pod-manager', icon: Crown, description: 'Manage pods and teams' },
  { id: 'teamLeader', label: 'Team Leader', href: '/team-leader', icon: Activity, description: 'Lead your team' },
  { id: 'competitionRunner', label: 'Competition Runner', href: '/competition-runner', icon: Trophy, description: 'Manage competitions' },
];

const navItems: { label: string; href: string; icon: React.ElementType; app: AppType }[] = [
  { label: 'Competitions', href: '/competitions', icon: Trophy, app: 'competitions' },
  { label: 'Trackers', href: '/trackers', icon: Target, app: 'trackers' },
  { label: 'Performance', href: '/performance', icon: BarChart3, app: 'performance' },
  { label: 'Mini Games', href: '/mini-games', icon: Gamepad2, app: 'mini-games' },
  { label: 'Settings', href: '/settings', icon: Settings, app: 'settings' },
];

export function AppNavBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [currentView, setCurrentView] = React.useState<string>('admin');

  const isActive = (href: string) => {
    if (href === '/competitions') {
      return pathname.startsWith('/competitions') || pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

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

  React.useEffect(() => {
    if (pathname.startsWith('/admin')) {
      setCurrentView('admin');
    } else if (pathname.startsWith('/agent')) {
      setCurrentView('agent');
    } else if (pathname.startsWith('/pod-support')) {
      setCurrentView('podSupport');
    } else if (pathname.startsWith('/pod-manager')) {
      setCurrentView('podManager');
    } else if (pathname.startsWith('/team-leader')) {
      setCurrentView('teamLeader');
    } else if (pathname.startsWith('/competition-runner')) {
      setCurrentView('competitionRunner');
    }
  }, [pathname]);

  const availableViews = React.useMemo(() => {
    if (!currentUser?.roles) return [roleViews[0]];
    
    const userRoles = currentUser.roles;
    return roleViews.filter(view => userRoles.includes(view.id));
  }, [currentUser?.roles]);

  const currentViewInfo = roleViews.find(v => v.id === currentView) || roleViews[0];
  const CurrentViewIcon = currentViewInfo.icon;

  const handleRoleSwitch = (view: RoleView) => {
    setCurrentView(view.id);
    router.push(view.href);
  };

  const handleLogout = async () => {
    const auth = getAuth(app);
    await auth.signOut();
    window.location.href = '/login';
  };

  return (
    <nav className={cn("glass-sidebar sticky top-0 z-50 flex items-center justify-between px-6 py-3", className)}>
      <div className="flex items-center gap-2">
        <Link href={currentViewInfo.href} className="flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">KPI Quest</span>
        </Link>

        <div className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}>
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
        {/* Role Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-3 py-1.5 h-auto">
              <CurrentViewIcon className="w-4 h-4" />
              <span className="text-sm font-medium">{currentViewInfo.label}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch View</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableViews.map((view) => {
              const ViewIcon = view.icon;
              return (
                <DropdownMenuItem 
                  key={view.id}
                  onClick={() => handleRoleSwitch(view)}
                  className={cn(
                    "cursor-pointer",
                    currentView === view.id && "bg-primary/10 text-primary"
                  )}
                >
                  <ViewIcon className="w-4 h-4 mr-2" />
                  <div className="flex flex-col">
                    <span>{view.label}</span>
                    <span className="text-xs text-muted-foreground">{view.description}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile Dropdown */}
        {currentUser ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto rounded-lg">
                <Avatar className="w-8 h-8 border-2 border-glass-border">
                  <AvatarImage src={currentUser.avatarUrl} />
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {generateInitials(currentUser.name || currentUser.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium leading-none">{currentUser.name || currentUser.email}</p>
                  <p className="text-xs text-muted-foreground capitalize leading-none mt-0.5">{currentUser.roles?.[0] || 'User'}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleLogout} 
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login">
            <Button variant="glass" size="sm">Sign In</Button>
          </Link>
        )}
      </div>
    </nav>
  );
}
