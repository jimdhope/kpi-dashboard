'use client';

import React from 'react';
import { NavDropdown, type NavDropdownItem } from './nav-dropdown';
import { cn } from '@/lib/utils';

interface NavBarMenuProps {
  label: string;
  href: string;
  items: NavDropdownItem[];
  icon?: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick?: () => void;
  dropdownKey?: string;
}

export function NavBarMenu({ label, href, items, icon: Icon, isActive, onClick, dropdownKey }: NavBarMenuProps) {
  return (
    <NavDropdown
      items={items}
      href={href}
      trigger={
        <span className="flex items-center gap-2">
          {Icon && <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />}
          <span className="text-sm font-medium">{label}</span>
        </span>
      }
      onClick={onClick}
      dropdownKey={dropdownKey}
    />
  );
}
