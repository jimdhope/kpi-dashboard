'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import type { PermissionMap } from '@/hooks/use-permissions';
import { cn, generateInitials } from '@/lib/utils';
import { 
  Trophy, Target, BarChart3, Gamepad2, User, ChevronDown, Shield, Megaphone, 
  Crown, Activity, Bell, Search, Menu, Settings, LayoutDashboard, Home, CheckSquare,
  Award, LineChart, SettingsIcon, Users, FileText, Wrench, Phone, MessageSquare,
  CalendarDays, Zap, Flame, Infinity, BarChartBig, FileCheck2, BookOpen,
  BookMarked, Contact, Building2, Briefcase, ArrowUpDown, Grid3X3, WholeWord
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { AppUser } from '@/lib/contracts';
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
import { SETTINGS_NAVIGATION_GROUPS } from '@/components/settings/settings-navigation';
import { authClient } from '@/lib/auth-client';

export interface NavItemConfig {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  items: NavDropdownItem[];
}

export type NavVariant = 'default' | 'agent';

// V2 Menu Structure + V3 Integrations
const navItems: NavItemConfig[] = [
  { 
    key: 'knowledgeBase',
    label: 'Knowledge Base', 
    href: '/knowledge-base', 
    icon: BookMarked,
    items: [
      { label: 'Browse Articles', href: '/knowledge-base', icon: BookOpen, permissionKey: 'knowledgeBase.articles' },
      { label: 'Directory', href: '/directory', icon: Contact, permissionKey: 'directory' },
    ]
  },
  {
    key: 'activity',
    label: 'Activity',
    href: '/agent/activity',
    icon: Activity,
    items: [],
  },
  { 
    key: 'competitions',
    label: 'Competitions', 
    href: '/competitions', 
    icon: Trophy,
    items: [
      { label: 'Dashboard', href: '/competitions', icon: Home, permissionKey: 'competitions.dashboard' },
      { label: 'Log Scores', href: '/competitions/log', icon: CheckSquare, permissionKey: 'competitions.log', requiredLevel: 'MANAGE' },
      { label: 'Manage', href: '/competitions/manage', icon: Trophy, permissionKey: 'competitions.manage', requiredLevel: 'MANAGE' },
      { label: 'Certificates', href: '/competitions/certificates', icon: Award, permissionKey: 'competitions.certificates' },
      { label: 'Reports', href: '/reports', icon: FileText, permissionKey: 'reports' },
      { label: 'Gamification', href: '/admin/gamification', icon: Crown, permissionKey: 'settings', requiredLevel: 'MANAGE' },
    ]
  },
  { 
    key: 'performance',
    label: 'Performance', 
    href: '/performance', 
    icon: BarChart3,
    items: [
      { label: 'Dashboard', href: '/performance', icon: Home, permissionKey: 'performance.dashboard' },
      { label: 'Setup KPIs', href: '/performance/kpis', icon: Settings, permissionKey: 'performance.kpis', requiredLevel: 'MANAGE' },
      { label: 'Log Scores', href: '/performance/log', icon: CheckSquare, permissionKey: 'performance.log', requiredLevel: 'MANAGE' },
      { label: 'KPI Breakdown', href: '/performance/breakdown', icon: BarChart3, permissionKey: 'performance.breakdown' },
      { label: 'Performance Charts', href: '/performance/charts', icon: LineChart, permissionKey: 'performance.charts' },
    ]
  },
  { 
    key: 'miniGames',
    label: 'Mini Games', 
    href: '/mini-games', 
    icon: Gamepad2,
    items: [
      { label: 'Dashboard', href: '/mini-games', icon: Home, permissionKey: 'miniGames.play' },
      { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
      { label: 'Higher or Lower', href: '/mini-games/higher-lower', icon: Gamepad2 },
      { label: 'Daily Word', href: '/mini-games/daily-word', icon: Gamepad2 },
      { label: 'Sudoku', href: '/mini-games/sudoku', icon: Gamepad2 },
    ]
  },
  { 
    key: 'usefulTools',
    label: 'Tools', 
    href: '/tools', 
    icon: Wrench,
    items: [
      { label: 'Call Flow', href: '/call-flow', icon: Phone, openInNewTab: true, permissionKey: 'usefulTools.callFlow' },
      { label: 'Meter Reading Guide', href: '/meter-reading-guide', icon: BookOpen, permissionKey: 'usefulTools.meterReading' },
      { label: 'Instalment Plan', href: '/tools/instalment-plan', icon: CalendarDays, permissionKey: 'usefulTools.calculators' },
      { label: 'Energy Usage', href: '/tools/energy-usage', icon: Zap, permissionKey: 'usefulTools.calculators' },
      { label: 'Burns Test', href: '/tools/burns-test', icon: Flame, permissionKey: 'usefulTools.calculators' },
      { label: 'Dual Fuel', href: '/tools/dual-fuel', icon: Infinity, permissionKey: 'usefulTools.calculators' },
      { label: 'Tariff Comparison', href: '/tools/tariff-comparison', icon: BarChartBig, permissionKey: 'usefulTools.calculators' },
      { label: 'Agreed Reads', href: '/tools/agreed-reads', icon: FileCheck2, permissionKey: 'usefulTools.agreedReads' },
    ]
  },
  { 
    key: 'settings',
    label: 'Settings', 
    href: '/settings/general', 
    icon: SettingsIcon,
    items: SETTINGS_NAVIGATION_GROUPS,
  },
];

const agentNavItems: NavItemConfig[] = [
  {
    key: 'competitions',
    label: 'Competitions',
    href: '/agent/competitions',
    icon: Trophy,
    items: [
      { label: 'My Standings', href: '/agent/competitions', icon: Home, permissionKey: 'competitions.dashboard' },
      { label: 'Quick Score', href: '/quick-score', icon: Zap },
      { label: 'Log Scores', href: '/competitions/log', icon: CheckSquare, permissionKey: 'competitions.log', requiredLevel: 'MANAGE' },
      { label: 'Manage', href: '/competitions/manage', icon: Trophy, permissionKey: 'competitions.manage', requiredLevel: 'MANAGE' },
      { label: 'Certificates', href: '/competitions/certificates', icon: Award, permissionKey: 'competitions.certificates' },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    href: '/agent/performance',
    icon: BarChart3,
    items: [
      { label: 'My Performance', href: '/agent/performance', icon: BarChart3 },
    ],
  },
  {
    key: 'knowledgeBase',
    label: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookMarked,
    items: [
      { label: 'Browse Articles', href: '/knowledge-base', icon: BookOpen },
      { label: 'Directory', href: '/directory', icon: Contact, permissionKey: 'directory' },
    ],
  },
  {
    key: 'miniGames',
    label: 'Mini Games',
    href: '/mini-games',
    icon: Gamepad2,
    items: [
      { label: 'RPS Game', href: '/mini-games/rps', icon: Gamepad2 },
      { label: 'Higher or Lower', href: '/mini-games/higher-lower', icon: ArrowUpDown },
      { label: 'Daily Word', href: '/mini-games/daily-word', icon: WholeWord },
      { label: 'Daily Sudoku', href: '/mini-games/sudoku', icon: Grid3X3 },
    ],
  },
  {
    key: 'activity',
    label: 'My Activity',
    href: '/agent/activity',
    icon: Activity,
    items: [
      { label: 'My Activity', href: '/agent/activity', icon: Activity },
      { label: 'Feedback', href: '/feedback', icon: MessageSquare },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/settings/general',
    icon: SettingsIcon,
    items: SETTINGS_NAVIGATION_GROUPS,
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
    ],
  },
];

const roleDashboardHrefs: Record<string, string> = {
  admin: '/dashboard',
  campaignManager: '/dashboard',
  podManager: '/dashboard',
  teamLeader: '/dashboard',
  competitionRunner: '/dashboard',
  agent: '/dashboard',
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

export function AppNavBar({ user, navVariant = 'default', className, initialPermissions }: {
  user: AppUser | null;
  navVariant?: NavVariant;
  className?: string;
  initialPermissions?: PermissionMap;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = React.useState(0);

  const userRoles = user?.roles as string[] || [];
  const { getNavLevel, isLoading: permsLoading } = usePermissions(userRoles, initialPermissions);

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
    if (!permsLoading) {
      const level = getNavLevel(key);
      if (level === 'MANAGE') return 'admin';
      if (level === 'VIEW') return 'agent';
      return 'none';
    }
    // Fallback while permissions load: admins get full access for correct initial render
    if (userRoles.includes('admin')) return 'admin';
    return 'none';
  };

  const hasRequiredAccess = (key: string, requiredLevel: 'VIEW' | 'MANAGE' = 'VIEW') => {
    const access = getHighestAccess(key);
    return requiredLevel === 'MANAGE' ? access === 'admin' : access !== 'none';
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

  const filterPermittedItems = (items: NavDropdownItem[], fallbackKey: string): NavDropdownItem[] =>
    items
      .filter((item) => hasRequiredAccess(item.permissionKey ?? fallbackKey, item.requiredLevel))
      .map((item) => ({
        ...item,
        children: item.children ? filterPermittedItems(item.children, item.permissionKey ?? fallbackKey) : undefined,
      }))
      .filter((item) => !item.children || item.children.length > 0);

  const sourceItems = navVariant === 'agent' ? agentNavItems : navItems;
  const visibleNavItems = sourceItems
    .filter(item => getNavHref(item) !== null)
    .map(item => ({
      ...item,
      items: filterPermittedItems(item.items, item.key),
    }));

  const dashboardHref = roleDashboardHrefs[primaryRole] || '/dashboard';
  const usesAgentNavigation = navVariant === 'agent';
  const dashboardLabel = usesAgentNavigation ? 'My Dashboard' : roleDashboardLabels[primaryRole] || 'Dashboard';
  const RoleIcon = usesAgentNavigation ? User : roleIcons[primaryRole] || User;
  const profileHref = usesAgentNavigation ? '/agent/profile' : '/settings/profile';

  const hasSettingsAccess = getHighestAccess('settings') !== 'none';
  const visibleSettingsItems = navItems
    .find(item => item.key === 'settings')
    ? filterPermittedItems(navItems.find(item => item.key === 'settings')?.items ?? [], 'settings')
    : [];

  const handleLogout = async () => {
    await authClient.signOut();
    window.location.href = '/login';
  };

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    const loadUnreadCount = () => fetch('/api/notifications').then((response) => response.ok ? response.json() : null).then((data) => {
      if (active && data) setUnreadNotificationCount(data.unreadCount ?? 0);
    }).catch(() => undefined);
    loadUnreadCount();
    const interval = window.setInterval(loadUnreadCount, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user?.id]);

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
          <SheetContent
            side="left"
            className="flex h-dvh max-h-dvh w-[280px] flex-col overflow-hidden p-0 pt-4"
          >
            <div className="shrink-0 border-b px-4 pb-4">
              <Link 
                href={dashboardHref} 
                prefetch={false}
                className="flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">KPI Quest</span>
              </Link>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
              <SheetClose asChild>
                <Link href={dashboardHref} prefetch={false}>
                  <Button
                    variant={isActive(dashboardHref) ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2 h-11"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{dashboardLabel}</span>
                  </Button>
                </Link>
              </SheetClose>
              {visibleNavItems.filter(item => item.key !== 'settings').map((item) => {
                const Icon = item.icon;
                const href = getNavHref(item);
                if (!href) return null;
                if (item.items.length === 0) {
                  return (
                    <SheetClose asChild key={item.key}>
                      <Link href={href}>
                        <Button
                          variant={isActive(href) ? "secondary" : "ghost"}
                          className="w-full justify-start gap-2 h-11"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Button>
                      </Link>
                    </SheetClose>
                  );
                }
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
                  {visibleSettingsItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    if (subItem.children?.length) {
                      return (
                        <div key={subItem.href} className="ml-2">
                          <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-foreground">
                            {SubIcon && <SubIcon className="h-4 w-4 text-muted-foreground" />}
                            <span>{subItem.label}</span>
                          </div>
                          {subItem.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <SheetClose asChild key={child.href}>
                                <Link href={child.href}>
                                  <Button
                                    variant={isActive(child.href) ? "secondary" : "ghost"}
                                    className="ml-4 h-10 w-[calc(100%-1rem)] justify-start gap-2"
                                  >
                                    {ChildIcon && <ChildIcon className="h-4 w-4" />}
                                    <span>{child.label}</span>
                                  </Button>
                                </Link>
                              </SheetClose>
                            );
                          })}
                        </div>
                      );
                    }
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
                <Link href={profileHref}>
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
        <Link href={dashboardHref} prefetch={false} className="hidden lg:flex items-center gap-2 mr-4">
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
          <Link href={dashboardHref} prefetch={false}>
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

              const trigger = (
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </span>
              );

              if (item.items.length === 0) {
                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-4 py-2 transition-all duration-200",
                      isActive(href)
                        ? "border border-primary/30 bg-primary/20 text-primary"
                        : "text-muted-foreground hover:bg-glass/50 hover:text-foreground",
                    )}
                  >
                    {trigger}
                  </Link>
                );
              }

              return (
                <NavDropdown
                  key={item.key}
                  dropdownKey={item.key}
                  items={item.items}
                  href={href}
                  trigger={trigger}
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
        
        {user && (
          <Button asChild variant="ghost" size="icon" className="relative rounded-lg" aria-label="Open notifications">
            <Link href="/notifications">
              <Bell className="h-4 w-4" />
              {unreadNotificationCount > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 text-destructive-foreground">{unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}</span>}
            </Link>
          </Button>
        )}

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
                <Link href={profileHref} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/notifications" className="cursor-pointer">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/feedback" className="cursor-pointer">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Feedback
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
