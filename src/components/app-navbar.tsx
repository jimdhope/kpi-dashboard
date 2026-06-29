'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn, generateInitials } from '@/lib/utils';
import { 
  Trophy, Target, BarChart3, Gamepad2, User, ChevronDown, Shield, Megaphone, 
  Crown, Activity, Search, Menu, Settings, LayoutDashboard, Home, CheckSquare, 
  Award, LineChart, SettingsIcon, Users, FileText, Wrench, Phone,
  CalendarDays, Zap, Flame, Infinity, BarChartBig, FileCheck2, BookOpen,
  BookMarked, Contact, Building2, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { AppUser } from '@/lib/contracts';
import { NotificationBell } from '@/components/notification-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { NavDropdown, NavigationProvider, type NavDropdownItem } from './nav-dropdown';

interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  items: NavDropdownItem[];
}

// V2 Menu Structure + V3 Integrations
const navItems: NavItemConfig[] = [
  { 
    key: 'knowledgeBase',
    label: 'Knowledge Base', 
    href: '/knowledge-base', 
    icon: BookMarked,
    items: [
      { label: 'Browse Articles', href: '/knowledge-base', icon: BookOpen },
      { label: 'Directory', href: '/directory', icon: Contact },
    ]
  },
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
      { label: 'Gamification', href: '/admin/gamification', icon: Award },
      { label: 'Reports', href: '/reports', icon: FileText },
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
    key: 'usefulTools',
    label: 'Tools', 
    href: '/tools', 
    icon: Wrench,
    items: [
      { label: 'Call Flow', href: '/call-flow', icon: Phone, openInNewTab: true },
      { label: 'Meter Reading Guide', href: '/meter-reading-guide', icon: BookOpen },
      { label: 'Instalment Plan', href: '/tools/instalment-plan', icon: CalendarDays },
      { label: 'Energy Usage', href: '/tools/energy-usage', icon: Zap },
      { label: 'Burns Test', href: '/tools/burns-test', icon: Flame },
      { label: 'Dual Fuel', href: '/tools/dual-fuel', icon: Infinity },
      { label: 'Tariff Comparison', href: '/tools/tariff-comparison', icon: BarChartBig },
      { label: 'Agreed Reads', href: '/tools/agreed-reads', icon: FileCheck2 },
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
      { label: 'Activity', href: '/agent/activity', icon: Activity },
      { label: 'Teams Webhooks', href: '/settings/teams-webhooks', icon: SettingsIcon },
      { label: 'Teams Workflows', href: '/settings/teams/workflows', icon: SettingsIcon },
    ]
  },
];

// Simplified role permissions for V3
const rolePermissions: Record<string, Record<string, 'admin' | 'agent' | 'none'>> = {
  admin: {
    knowledgeBase: 'admin',
    directory: 'admin',
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    usefulTools: 'agent',
    activity: 'admin',
    settings: 'admin',
  },
  campaignManager: {
    knowledgeBase: 'admin',
    directory: 'admin',
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    usefulTools: 'agent',
    activity: 'admin',
    settings: 'admin',
  },
  podManager: {
    knowledgeBase: 'admin',
    directory: 'admin',
    competitions: 'admin',
    trackers: 'admin',
    performance: 'admin',
    reports: 'admin',
    miniGames: 'admin',
    usefulTools: 'agent',
    activity: 'admin',
    settings: 'admin',
  },
  teamLeader: {
    knowledgeBase: 'admin',
    directory: 'admin',
    competitions: 'admin',
    trackers: 'admin',
    performance: 'agent',
    reports: 'agent',
    miniGames: 'agent',
    usefulTools: 'agent',
    activity: 'agent',
    settings: 'admin',
  },
  competitionRunner: {
    knowledgeBase: 'admin',
    directory: 'admin',
    competitions: 'admin',
    trackers: 'agent',
    performance: 'agent',
    reports: 'agent',
    miniGames: 'agent',
    usefulTools: 'agent',
    activity: 'agent',
    settings: 'admin',
  },
  agent: {
    knowledgeBase: 'agent',
    directory: 'agent',
    competitions: 'agent',
    trackers: 'agent',
    performance: 'agent',
    reports: 'none',
    miniGames: 'agent',
    usefulTools: 'agent',
    activity: 'agent',
    settings: 'none',
    integrations: 'none',
  },
};

const roleDashboardHrefs: Record<string, string> = {
  admin: '/dashboard',
  campaignManager: '/dashboard',
  podManager: '/dashboard',
  teamLeader: '/dashboard',
  competitionRunner: '/dashboard',
  agent: '/agent',
};

const roleDashboardLabels: Record<string, string> = {
  admin: 'Dashboard',
  campaignManager: 'Dashboard',
  podManager: 'Dashboard',
  teamLeader: 'Dashboard',
  competitionRunner: 'Dashboard',
  agent: 'My Dashboard',
};

const roleIcons: Record<string, React.ElementType> = {
  admin: Shield,
  campaignManager: Megaphone,
  podManager: Crown,
  teamLeader: Activity,
  competitionRunner: Trophy,
  agent: User,
};

const rolePriority = ['admin', 'campaignManager', 'podManager', 'teamLeader', 'competitionRunner', 'agent'];

export function AppNavBar({ user, className }: { user: AppUser | null; className?: string }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const userRoles = user?.roles as string[] || [];

  const getHighestRole = (): string => {
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
    // Agents go to /agent/ versions
    if (access === 'agent' && item.key !== 'activity') {
      return `/agent/${item.key}`;
    }
    return item.href;
  };

  const visibleNavItems = navItems.filter(item => getNavHref(item) !== null);

  const dashboardHref = roleDashboardHrefs[primaryRole] || '/dashboard';
  const dashboardLabel = roleDashboardLabels[primaryRole] || 'Dashboard';
  const RoleIcon = roleIcons[primaryRole] || User;

  const hasSettingsAccess = userRoles.some(role => 
    ['admin', 'campaignManager', 'podManager', 'teamLeader', 'competitionRunner'].includes(role)
  );

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  const isActive = (href: string) => {
    return pathname?.startsWith(href);
  };

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
                      const linkProps = subItem.openInNewTab 
                        ? { target: "_blank", rel: "noopener noreferrer" } 
                        : {};
                      return (
                        <SheetClose asChild key={subItem.href}>
                          <Link href={subItem.href} {...linkProps}>
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
                <Link href="/call-flow" target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-11"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Call Flow</span>
                  </Button>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link href={primaryRole === 'agent' ? '/agent/profile' : '/settings/profile'}>
                  <Button
                    variant={isActive('/settings/profile') ? "secondary" : "ghost"}
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
          <Image 
            src="/logo.svg" 
            alt="KPI Quest Logo" 
            width={40} 
            height={40} 
            className="h-8 w-8"
            unoptimized
          />
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
              if (!href) return null;

              return (
                <NavDropdown
                  key={item.key}
                  dropdownKey={item.key}
                  items={item.items}
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
        {/* Search - opens command palette */}
        <Button
          variant="ghost"
          size="sm"
          className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            document.dispatchEvent(new CustomEvent('open-search'));
          }}
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Search</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-glass-border bg-glass/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        
        {/* Notifications */}
        {user && <NotificationBell />}

        {/* User Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2 py-1.5 h-auto rounded-lg">
                <Avatar className="w-8 h-8 border-2 border-glass-border">
                  <AvatarFallback className="bg-primary/20 text-primary text-sm">
                    {generateInitials(user.name || user.email || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left">
                  <p className="text-sm font-medium leading-none">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize leading-none mt-0.5">{primaryRole.replace(/([A-Z])/g, ' $1').trim()}</p>
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={primaryRole === 'agent' ? '/agent/profile' : '/settings/profile'} className="cursor-pointer">
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
