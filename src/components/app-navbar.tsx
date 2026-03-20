'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  Trophy, Target, BarChart3, Gamepad2, User, ChevronDown, Shield, Megaphone, 
  Crown, Activity, Search, Menu, Settings, LayoutDashboard, Home, CheckSquare, 
  Award, LineChart, SettingsIcon, Users, Bell, FileText
} from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useIsMobile } from '@/hooks/use-mobile';
import { NavDropdown, NavigationProvider, type NavDropdownItem } from './nav-dropdown';
import { NotificationBell } from '@/components/notifications';

interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  items: NavDropdownItem[];
}

const navItems: NavItemConfig[] = [
  { 
    key: 'competitions',
    label: 'Competitions', 
    href: '/competitions', 
    icon: Trophy,
    items: [
      { label: 'Dashboard', href: '/competitions', icon: Home },
      { label: 'Log Scores', href: '/competitions/log', icon: CheckSquare },
      { label: 'Manage', href: '/competitions/manage', icon: Trophy },
      { label: 'Certificates', href: '/competitions/certificates', icon: Award },
    ]
  },
  { 
    key: 'trackers',
    label: 'Trackers', 
    href: '/trackers', 
    icon: Target,
    items: [
      { label: 'Dashboard', href: '/trackers', icon: Home },
      { label: 'Setup Trackers', href: '/trackers/setup', icon: Settings },
      { label: 'Log Scores', href: '/trackers/log', icon: CheckSquare },
    ]
  },
  { 
    key: 'performance',
    label: 'Performance', 
    href: '/performance', 
    icon: BarChart3,
    items: [
      { label: 'Dashboard', href: '/performance', icon: Home },
      { label: 'Reports', href: '/reports', icon: FileText },
      { label: 'Setup KPIs', href: '/performance/kpis', icon: Settings },
      { label: 'Log Scores', href: '/performance/log', icon: CheckSquare },
      { label: 'KPI Breakdown', href: '/performance/breakdown', icon: BarChart3 },
      { label: 'Performance Charts', href: '/performance/charts', icon: LineChart },
    ]
  },
  { 
    key: 'miniGames',
    label: 'Mini Games', 
    href: '/mini-games', 
    icon: Gamepad2,
    items: [
      { label: 'Dashboard', href: '/mini-games', icon: Home },
      { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
    ]
  },
  { 
    key: 'activity',
    label: 'Activity', 
    href: '/agent/activity', 
    icon: Activity,
    items: [
      { label: 'Activity History', href: '/agent/activity', icon: Activity },
    ]
  },
  { 
    key: 'settings',
    label: 'Settings', 
    href: '/settings/general', 
    icon: SettingsIcon,
    items: [
      { label: 'General', href: '/settings/general', icon: SettingsIcon },
      { label: 'Campaigns', href: '/settings/campaigns', icon: Megaphone },
      { label: 'Pods', href: '/settings/pods', icon: Shield },
      { label: 'Users', href: '/settings/users', icon: Users },
    ]
  },
];

// Exported for use in breadcrumbs
export const appMenuItems = navItems.map(item => ({
  key: item.key,
  label: item.label,
  href: item.href,
  icon: item.icon,
  items: item.items,
}));

const rolePermissions: Record<UserRole, Record<string, 'admin' | 'agent' | 'none'>> = {
  admin: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    activity: 'admin',
    settings: 'admin',
  },
  campaignManager: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    activity: 'admin',
    settings: 'admin',
  },
  podManager: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    activity: 'admin',
    settings: 'admin',
  },
  teamLeader: {
    competitions: 'admin',
    trackers: 'admin',
    performance: 'agent',
    reports: 'agent',
    miniGames: 'agent',
    activity: 'agent',
    settings: 'admin',
  },
  competitionRunner: {
    competitions: 'admin',
    trackers: 'agent',
    performance: 'agent',
    reports: 'agent',
    miniGames: 'agent',
    activity: 'agent',
    settings: 'admin',
  },
  agent: {
    competitions: 'agent',
    trackers: 'agent',
    performance: 'agent',
    reports: 'none',
    miniGames: 'agent',
    activity: 'agent',
    settings: 'none',
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
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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

  const getNavHref = (item: NavItemConfig): string | null => {
    const access = getHighestAccess(item.key);
    if (access === 'none') return null;
    return access === 'admin' ? item.href : `/agent/${item.key}`;
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
    <nav className={cn("glass-sidebar sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 py-3", className)}>
      <div className="flex items-center gap-2">
        {/* Mobile Menu Trigger */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0 pt-4">
            <div className="px-4 pb-4 border-b">
              <Link 
                href={dashboardHref} 
                className="flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">KPI Quest</span>
              </Link>
            </div>
            <div className="flex flex-col gap-1 p-2">
              <SheetClose asChild>
                <Link href={dashboardHref}>
                  <Button
                    variant={isActive(dashboardHref) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 h-11"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{dashboardLabel}</span>
                  </Button>
                </Link>
              </SheetClose>
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const href = getNavHref(item);
                if (!href) return null;
                return (
                  <div key={item.key}>
                    <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {item.label}
                    </p>
                    {item.items.map((subItem) => {
                      const SubIcon = subItem.icon;
                      return (
                        <SheetClose asChild key={subItem.href}>
                          <Link href={subItem.href}>
                            <Button
                              variant={isActive(subItem.href) ? "secondary" : "ghost"}
                              className="w-full justify-start gap-2 h-11 ml-2"
                            >
                              {SubIcon && <SubIcon className="h-4 w-4" />}
                              <span>{subItem.label}</span>
                            </Button>
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                );
              })}
              {hasSettingsAccess && (
                <>
                  <div className="h-px bg-border my-2" />
                  <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Settings
                  </p>
                  {navItems.find(item => item.key === 'settings')?.items.map((subItem) => {
                    const SubIcon = subItem.icon;
                    return (
                      <SheetClose asChild key={subItem.href}>
                        <Link href={subItem.href}>
                          <Button
                            variant={isActive(subItem.href) ? "secondary" : "ghost"}
                            className="w-full justify-start gap-2 h-11 ml-2"
                          >
                            {SubIcon && <SubIcon className="h-4 w-4" />}
                            <span>{subItem.label}</span>
                          </Button>
                        </Link>
                      </SheetClose>
                    );
                  })}
                </>
              )}
              <div className="h-px bg-border my-2" />
              <SheetClose asChild>
                <Link href="/agent/profile">
                  <Button
                    variant={isActive('/agent/profile') ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 h-11"
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Button>
                </Link>
              </SheetClose>
            </div>
          </SheetContent>
        </Sheet>

        {/* Desktop Logo */}
        <Link href={dashboardHref} className="hidden lg:flex items-center gap-2 mr-4">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">KPI Quest</span>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
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

          <NavigationProvider>
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const href = getNavHref(item);
              const access = getHighestAccess(item.key);
              if (!href) return null;
              
              // Adjust items to use correct href based on access level
              const adjustedItems = item.items.map(subItem => {
                // If agent access, prefix with /agent
                if (access === 'agent' && href.startsWith('/agent')) {
                  return {
                    ...subItem,
                    href: subItem.href.replace(/^\/(competitions|trackers|performance|mini-games)/, '/agent/$1')
                  };
                }
                return subItem;
              });

              return (
                <NavDropdown
                  key={item.key}
                  dropdownKey={item.key}
                  items={adjustedItems}
                  href={href}
                  trigger={
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </span>
                  }
                />
              );
            })}
          </NavigationProvider>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Search shortcut hint - hidden on mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            // Dispatch keyboard shortcut to open command palette
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
            document.dispatchEvent(event);
          }}
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Search</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-glass-border bg-glass/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        
        {/* Notification Bell */}
        <NotificationBell />
        
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
                      <SettingsIcon className="w-4 h-4 mr-2" />
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
