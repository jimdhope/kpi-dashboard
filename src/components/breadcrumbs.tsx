'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  className?: string;
  homeHref?: string;
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
};

// Map of parent routes to their labels
const parentLabels: Record<string, string> = {
  '/competitions': 'Competitions',
  '/agent/competitions': 'Competitions',
  '/trackers': 'Trackers',
  '/agent/trackers': 'Trackers',
  '/performance': 'Performance',
  '/agent/performance': 'Performance',
  '/settings': 'Settings',
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

export function Breadcrumbs({ className, homeHref = '/' }: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Split pathname into segments and filter out empty strings
  const segments = pathname.split('/').filter(Boolean);
  
  // Don't show breadcrumbs on dashboard/home pages
  if (segments.length === 0 || 
      (segments.length === 1 && ['competitions', 'trackers', 'performance', 'settings', 'admin', 'agent', 'campaign-manager', 'pod-manager', 'team-leader', 'competition-runner', 'mini-games'].includes(segments[0]))) {
    // Check if this is the base route (no sub-pages)
    const baseRoutes = ['/competitions', '/trackers', '/performance', '/settings', '/admin', '/agent', '/campaign-manager', '/pod-manager', '/team-leader', '/competition-runner', '/mini-games'];
    if (baseRoutes.includes('/' + segments.join('/')) || segments.length === 0) {
      return null;
    }
  }
  
  // Build breadcrumb items
  const items: BreadcrumbItem[] = [];
  
  // Add home/dashboard link
  items.push({
    label: 'Dashboard',
    href: '/' + (segments[0] || ''),
  });
  
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
  
  // Don't show breadcrumbs if there's only the home link
  if (items.length <= 1) {
    return null;
  }
  
  return (
    <nav aria-label="Breadcrumb" className={cn('py-3 px-6 relative z-30 bg-background/80 backdrop-blur-sm', className)}>
      <ol className="flex items-center gap-1.5 text-sm">
        {items.map((item, index) => {
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
        })}
      </ol>
    </nav>
  );
}

export { routeLabels, parentLabels };
