'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileNavDropdown, type NavItem } from './mobile-nav-dropdown';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  className?: string;
  homeHref?: string;
  sectionItems?: NavItem[];
}

// Route segment to label mapping
const routeLabels: Record<string, string> = {
  competitions: 'Competitions',
  create: 'Create Competition',
  manage: 'Manage',
  log: 'Log',
  certificates: 'Certificates',
  dashboard: 'Dashboard',
  trackers: 'Trackers',
  setup: 'Setup',
  performance: 'Performance',
  breakdown: 'Breakdown',
  charts: 'Charts',
  kpis: 'KPIs',
  leaderboard: 'Leaderboard',
  reports: 'Reports',
  settings: 'Settings',
  profile: 'Profile',
  general: 'General',
  pods: 'Pods',
  users: 'Users',
  campaigns: 'Campaigns',
  notifications: 'Notifications',
  admin: 'Admin',
  agent: 'Agent',
  campaignManager: 'Campaign Manager',
  podManager: 'Pod Manager',
  teamLeader: 'Team Leader',
  competitionRunner: 'Competition Runner',
  miniGames: 'Mini Games',
  manageTeam: 'Manage Team',
  managePods: 'Manage Pods',
  manageCampaigns: 'Manage Campaigns',
  activity: 'Activity History',
  teams: 'Teams',
  channels: 'Channels',
  automations: 'Automations',
  scheduled: 'Scheduled',
};

// Map of parent routes to their labels
const parentLabels: Record<string, string> = {
  '/competitions': 'Competitions',
  '/agent/competations': 'Competitions',
  '/trackers': 'Trackers',
  '/agent/trackers': 'Trackers',
  '/performance': 'Performance',
  '/agent/performance': 'Performance',
  '/settings': 'Settings',
  '/settings/teams': 'Teams',
  '/admin': 'Admin',
  '/agent': 'Agent Dashboard',
  '/campaign-manager': 'Campaign Manager',
  '/pod-manager': 'Pod Manager',
  '/team-leader': 'Team Leader',
  '/competition-runner': 'Competition Runner',
  '/mini-games': 'Mini Games',
  '/agent/mini-games': 'Mini Games',
};

function formatLabel(segment: string): string {
  // Check if there's a direct mapping
  if (routeLabels[segment]) {
    return routeLabels[segment];
  }
  
  // Convert kebab-case or camelCase to Title Case
  return segment
    .replace(/-/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

export function Breadcrumbs({ className, homeHref = '/', sectionItems }: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Split pathname into segments and filter out empty strings
  const segments = pathname.split('/').filter(Boolean);
  
  // Check if this is a dashboard/base route
  const baseRoutes = ['competitions', 'trackers', 'performance', 'settings', 'admin', 'agent', 'campaign-manager', 'pod-manager', 'team-leader', 'competition-runner', 'mini-games'];
  const isBaseRoute = segments.length === 0 || (segments.length === 1 && baseRoutes.includes(segments[0]));
  
  // Build breadcrumb items (only for non-dashboard routes)
  const items: BreadcrumbItem[] = [];
  
  if (!isBaseRoute) {
    // Build nested paths for each segment
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const href = '/' + segments.slice(0, i + 1).join('/');
      
      // Check if this is the last (current) segment
      const isLast = i === segments.length - 1;
      
      if (isLast) {
        // For the last segment, show the formatted label (not clickable)
        items.push({
          label: formatLabel(segment),
          href: '', // Empty href means not clickable
        });
      } else {
        items.push({
          label: formatLabel(segment),
          href,
        });
      }
    }
  }
  
  // Get section name for mobile view
  const sectionName = isBaseRoute 
    ? formatLabel(segments[0] || '')
    : items.length > 0 ? items[items.length - 1].label : '';
  
  // Hide entire component on desktop when no items and no mobile dropdown needed
  if (items.length <= 1 && (!sectionItems || sectionItems.length === 0)) {
    return null;
  }
  
  // On mobile, always show the bar with section name + dropdown
  // On desktop, only show full breadcrumbs when not on dashboard
  const showFullBreadcrumbs = items.length > 1;
  
  return (
    <nav aria-label="Breadcrumb" className={cn('py-3 px-6 relative z-30 bg-background/80 backdrop-blur-sm', className)}>
      <div className="flex items-center justify-between gap-4">
        {/* Full breadcrumb trail - hidden on mobile when showing section name */}
        <ol className={cn("flex items-center gap-1.5 text-sm", !showFullBreadcrumbs && "lg:flex", !showFullBreadcrumbs && "hidden lg:block")}>
          {isBaseRoute ? (
            // On dashboard pages, show just the section name on desktop
            <li>
              <span className="font-semibold text-foreground text-primary">
                {sectionName || 'Dashboard'}
              </span>
            </li>
          ) : (
            // On sub-pages, show breadcrumb trail (without Dashboard prefix)
            items.map((item, index) => {
              const isLast = index === items.length - 1;
              
              return (
                <li key={index} className="flex items-center gap-1.5">
                  {index > 0 && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                  )}
                  {item.href && !isLast ? (
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className={cn(
                      "font-semibold text-foreground",
                      isLast && "text-primary"
                    )}>
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ol>
        
        {/* Mobile section navigation dropdown - shows on mobile and when on dashboard */}
        {sectionItems && sectionItems.length > 0 && (
          <MobileNavDropdown items={sectionItems} currentSection={sectionName} />
        )}
      </div>
    </nav>
  );
}

export { routeLabels, parentLabels };
