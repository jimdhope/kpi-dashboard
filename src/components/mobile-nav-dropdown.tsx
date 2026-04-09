'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MobileNavDropdownProps {
  items: NavItem[];
  className?: string;
  currentSection?: string;
}

export function MobileNavDropdown({ items, className, currentSection }: MobileNavDropdownProps) {
  const pathname = usePathname();

  // Find active item based on current pathname
  const activeItem = items.find((item) => {
    if (item.href === '/') return pathname === '/';
    return pathname === item.href || pathname.startsWith(item.href + '/');
  }) || items[0];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  };

  // Use passed currentSection or fall back to active item label
  const displayLabel = currentSection || activeItem?.label || 'Menu';

  return (
    <div className={cn('lg:hidden', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-lg glass-button text-sm font-medium transition-all duration-200 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Open navigation menu"
          >
            <List className="w-5 h-5" />
            <span className="hidden sm:inline">{displayLabel}</span>
            <ChevronRight className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-90" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-64 glass-dropdown min-w-[200px]"
          sideOffset={8}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            
            return (
              <React.Fragment key={item.href}>
                <DropdownMenuItem asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 w-full min-h-[44px] px-3 py-2 cursor-pointer',
                      'focus:bg-primary/10 focus:text-foreground',
                      active && 'bg-primary/15 text-primary font-medium'
                    )}
                  >
                    {Icon && <Icon className={cn('w-4 h-4', active ? 'text-primary' : 'text-muted-foreground')} />}
                    <span className="flex-1">{item.label}</span>
                    {active && (
                      <ChevronRight className="w-4 h-4 text-primary" />
                    )}
                  </Link>
                </DropdownMenuItem>
                {index < items.length - 1 && (
                  <DropdownMenuSeparator className="bg-glass-border/40" />
                )}
              </React.Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
