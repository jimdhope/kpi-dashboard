'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface NavDropdownItem {
  label: string;
  href: string;
  icon?: React.ElementType;
  openInNewTab?: boolean;
  /** Permission resource to use when it differs from the parent menu section. */
  permissionKey?: string;
  /** Minimum permission needed to display this destination. */
  requiredLevel?: 'VIEW' | 'MANAGE';
  children?: NavDropdownItem[];
}

interface NavDropdownProps {
  items: NavDropdownItem[];
  trigger: React.ReactNode;
  href: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  onClick?: () => void;
  dropdownKey?: string;
}

interface NavigationContextType {
  openDropdown: string | null;
  setOpenDropdown: (key: string | null) => void;
  closeDropdown: () => void;
}

const NavigationContext = createContext<NavigationContextType>({
  openDropdown: null,
  setOpenDropdown: () => {},
  closeDropdown: () => {},
});

export function useNavigation() {
  return useContext(NavigationContext);
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const closeDropdown = useCallback(() => {
    setOpenDropdown(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ openDropdown, setOpenDropdown, closeDropdown }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function NavDropdown({ items, trigger, href, align = 'left', className, onClick, dropdownKey }: NavDropdownProps) {
  const key = dropdownKey || href;
  const { openDropdown, setOpenDropdown, closeDropdown } = useNavigation();
  const isOpen = openDropdown === key;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pathname = usePathname() || "";

  const isActive = (itemHref: string) => {
    if (itemHref === href) {
      return pathname === itemHref;
    }
    return pathname.startsWith(itemHref);
  };

  const clearPendingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const openCurrentDropdown = useCallback(() => {
    clearPendingTimeout();
    setOpenDropdown(key);
  }, [key, setOpenDropdown]);

  const closeCurrentDropdown = useCallback(() => {
    if (openDropdown === key) {
      closeDropdown();
    }
  }, [key, openDropdown, closeDropdown]);

  const handleMouseEnter = () => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      setOpenDropdown(key);
    }, 100);
  };

  const handleMouseLeave = () => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      closeCurrentDropdown();
    }, 200);
  };

  const handleDropdownMouseEnter = () => {
    clearPendingTimeout();
    setOpenDropdown(key);
  };

  const handleDropdownMouseLeave = () => {
    clearPendingTimeout();
    timeoutRef.current = setTimeout(() => {
      closeCurrentDropdown();
    }, 150);
  };

  const handleClick = () => {
    clearPendingTimeout();
    if (onClick) {
      onClick();
    }
    if (isOpen) {
      closeDropdown();
    } else {
      setOpenDropdown(key);
    }
  };

  useEffect(() => {
    return () => clearPendingTimeout();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeCurrentDropdown();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeCurrentDropdown]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeCurrentDropdown();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeCurrentDropdown]);

  const alignmentClasses = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0',
  };

  return (
    <div 
      ref={dropdownRef}
      className={cn("relative", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-lg transition-all duration-200",
          isOpen || isActive(href)
            ? "bg-primary/20 text-primary border border-primary/30" 
            : "text-muted-foreground hover:text-foreground hover:bg-glass/50"
        )}
      >
        {trigger}
        <ChevronDown className={cn(
          "w-3 h-3 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown */}
      <div
        onMouseEnter={handleDropdownMouseEnter}
        onMouseLeave={handleDropdownMouseLeave}
        className={cn(
          "absolute top-full mt-2 min-w-[220px] z-50",
          "opacity-0 invisible translate-y-2 transition-all duration-200",
          isOpen && "opacity-100 visible translate-y-0"
        )}
      >
        <div className={cn(
          "glass-menu rounded-xl p-2",
          alignmentClasses[align]
        )}>
          {items.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const childActive = item.children?.some((child) => isActive(child.href)) ?? false;
            const linkProps = item.openInNewTab 
              ? { target: "_blank", rel: "noopener noreferrer" } 
              : {};

            if (item.children?.length) {
              return (
                <div key={item.href}>
                  <details className="group/settings" open={childActive || undefined}>
                    <summary className={cn(
                      "flex min-h-[44px] cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 marker:content-none",
                      childActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-glass/60",
                    )}>
                      {Icon && <Icon className={cn("h-4 w-4 shrink-0", childActive ? "text-primary" : "text-muted-foreground")} />}
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-open/settings:rotate-90" />
                    </summary>
                    <div className="ml-4 mt-1 space-y-1 border-l border-glass-border/40 pl-2">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        const childIsActive = isActive(child.href);
                        return (
                          <Link key={child.href} href={child.href} onClick={() => closeDropdown()} className={cn(
                            "flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            childIsActive ? "bg-primary/15 font-medium text-primary" : "text-foreground hover:bg-glass/60",
                          )}>
                            {ChildIcon && <ChildIcon className={cn("h-4 w-4 shrink-0", childIsActive ? "text-primary" : "text-muted-foreground")} />}
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                  {index < items.length - 1 && <div className="mx-2 my-1 h-px bg-glass-border/30" />}
                </div>
              );
            }

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => closeDropdown()}
                  {...linkProps}
                  className={cn(
                    "flex items-center gap-3 w-full min-h-[44px] px-3 py-2.5 rounded-lg",
                    "transition-all duration-150 text-left",
                    active 
                      ? "bg-primary/15 text-primary font-medium" 
                      : "text-foreground hover:bg-glass/60"
                  )}
                >
                  {Icon && (
                    <Icon className={cn(
                      "w-4 h-4 flex-shrink-0",
                      active ? "text-primary" : "text-muted-foreground"
                    )} />
                  )}
                  <span className="flex-1">{item.label}</span>
                  {active && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
                {index < items.length - 1 && (
                  <div className="h-px bg-glass-border/30 mx-2 my-1" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
