
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

interface RoleSwitcherProps {
  availableRoles: UserRole[];
  currentLayout: 'admin' | 'agent';
  onLayoutChange: (newLayout: 'admin' | 'agent') => void;
}

export function RoleSwitcher({ availableRoles, currentLayout, onLayoutChange }: RoleSwitcherProps) {
  const canSeeAdmin = availableRoles.includes('admin') || availableRoles.includes('podManager') || availableRoles.includes('teamLeader');
  const canSeeAgent = availableRoles.includes('agent');
  const hasMultipleViews = canSeeAdmin && canSeeAgent;

  if (!hasMultipleViews) {
    return null; // Don't render if user only has one view type
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {currentLayout === 'admin' ? (
            <>
              <UserCog className="mr-2 h-4 w-4" /> Admin View
            </>
          ) : (
            <>
              <UserRound className="mr-2 h-4 w-4" /> Agent View
            </>
          )}
          <ChevronDown className="ml-2 h-4 w-4" />
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
