
'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCog, UserRound, ChevronDown } from 'lucide-react';
import type { UserRole } from '@/services/user';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  availableRoles: UserRole[] | undefined; // Allow undefined
  currentLayout: 'admin' | 'agent' | null;
  onLayoutChange: (newLayout: 'admin' | 'agent') => void;
}

export function RoleSwitcher({ availableRoles, currentLayout, onLayoutChange }: RoleSwitcherProps) {
  console.log("[RoleSwitcher] Received props:", { availableRoles, currentLayout });

  const safeAvailableRoles = Array.isArray(availableRoles) ? availableRoles : [];

  const canSeeAdmin = safeAvailableRoles.includes('admin') || safeAvailableRoles.includes('podManager') || safeAvailableRoles.includes('teamLeader');
  const canSeeAgent = safeAvailableRoles.includes('agent');
  const hasMultipleViews = canSeeAdmin && canSeeAgent;

  console.log("[RoleSwitcher] Computed values:", { canSeeAdmin, canSeeAgent, hasMultipleViews });

  if (!hasMultipleViews) {
    console.log("[RoleSwitcher] Not rendering: hasMultipleViews is false or availableRoles is not an array/empty.");
    return null;
  }

  console.log("[RoleSwitcher] Rendering dropdown.");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="whitespace-nowrap">
          {currentLayout === 'admin' ? (
            <>
              <UserCog className={cn("mr-1 h-4 w-4")} />
              {'Admin View'}
            </>
          ) : (
            <>
              <UserRound className={cn("mr-1 h-4 w-4")} />
              {'Agent View'}
            </>
          )}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canSeeAdmin && (
          <DropdownMenuItem onClick={() => onLayoutChange('admin')} disabled={currentLayout === 'admin'}>
            <UserCog className="mr-2 h-4 w-4" />
            <span>Admin View</span>
          </DropdownMenuItem>
        )}
        {canSeeAgent && (
          <DropdownMenuItem onClick={() => onLayoutChange('agent')} disabled={currentLayout === 'agent'}>
            <UserRound className="mr-2 h-4 w-4" />
            <span>Agent View</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
