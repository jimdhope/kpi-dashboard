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
import { cn } from '@/lib/utils'; // Import cn

interface RoleSwitcherProps {
  availableRoles: UserRole[];
  currentLayout: 'admin' | 'agent';
  onLayoutChange: (newLayout: 'admin' | 'agent') => void;
}

export function RoleSwitcher({ availableRoles, currentLayout, onLayoutChange }: RoleSwitcherProps) {
  // Add console log to check received props
  console.log("[RoleSwitcher] Received props:", { availableRoles, currentLayout });

  // Add a check to ensure availableRoles is an array before using .includes
  const safeAvailableRoles = Array.isArray(availableRoles) ? availableRoles : [];

  const canSeeAdmin = safeAvailableRoles.includes('admin') || safeAvailableRoles.includes('podManager') || safeAvailableRoles.includes('teamLeader');
  const canSeeAgent = safeAvailableRoles.includes('agent');
  const hasMultipleViews = canSeeAdmin && canSeeAgent;

  // Add console log to check computed values
  console.log("[RoleSwitcher] Computed values:", { canSeeAdmin, canSeeAgent, hasMultipleViews });

  if (!hasMultipleViews) {
     console.log("[RoleSwitcher] Not rendering: hasMultipleViews is false.");
    return null; // Don't render if user only has one view type or roles are invalid
  }

  console.log("[RoleSwitcher] Rendering dropdown.");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="whitespace-nowrap"> {/* Prevent wrapping */}
          {currentLayout === 'admin' ? (
            <>
              <UserCog className={cn("mr-1 h-4 w-4")} /> {/* Always show icon */}
              {'Admin View'} {/* Always show text */}
            </>
          ) : (
            <>
              <UserRound className={cn("mr-1 h-4 w-4")} /> {/* Always show icon */}
               {'Agent View'} {/* Always show text */}
            </>
          )}
           <ChevronDown className="ml-1 h-4 w-4" /> {/* Always show arrow */}
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
