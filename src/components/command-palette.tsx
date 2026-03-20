'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trophy, Target, BarChart3, Gamepad2, Settings, Shield, Home, Command, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Search result type
interface SearchResult {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href: string;
  category: 'navigation' | 'action' | 'data';
}

// Search providers interface - allows for future extensibility
interface SearchProvider {
  id: string;
  name: string;
  search: (query: string) => Promise<SearchResult[]>;
}

// Navigation routes that are always available
const navigationRoutes: SearchResult[] = [
  {
    id: 'nav-competitions',
    label: 'Competitions',
    description: 'View and manage competitions',
    icon: Trophy,
    href: '/competitions',
    category: 'navigation',
  },
  {
    id: 'nav-trackers',
    label: 'Trackers',
    description: 'Track KPI progress',
    icon: Target,
    href: '/trackers',
    category: 'navigation',
  },
  {
    id: 'nav-performance',
    label: 'Performance',
    description: 'View performance metrics',
    icon: BarChart3,
    href: '/performance',
    category: 'navigation',
  },
  {
    id: 'nav-mini-games',
    label: 'Mini Games',
    description: 'Play KPI mini games',
    icon: Gamepad2,
    href: '/mini-games',
    category: 'navigation',
  },
  {
    id: 'nav-settings',
    label: 'Settings',
    description: 'App configuration',
    icon: Settings,
    href: '/settings',
    category: 'navigation',
  },
  {
    id: 'nav-admin',
    label: 'Admin Dashboard',
    description: 'Administrative tools',
    icon: Shield,
    href: '/admin',
    category: 'navigation',
  },
];

// Default search function for navigation routes
const defaultSearchProvider: SearchProvider = {
  id: 'navigation',
  name: 'Navigation',
  search: async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      return navigationRoutes;
    }
    
    const lowerQuery = query.toLowerCase();
    return navigationRoutes.filter(
      (route) =>
        route.label.toLowerCase().includes(lowerQuery) ||
        route.description?.toLowerCase().includes(lowerQuery)
    );
  },
};

// Command palette state management
interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  results: SearchResult[];
  isLoading: boolean;
}

export function CommandPalette() {
  const router = useRouter();
  const [state, setState] = useState<CommandPaletteState>({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    results: navigationRoutes,
    isLoading: false,
  });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Registered search providers
  const [providers] = useState<SearchProvider[]>([defaultSearchProvider]);
  
  // Search across all providers
  const performSearch = useCallback(async (query: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const allResults = await Promise.all(
        providers.map(provider => provider.search(query))
      );
      
      const combined = allResults.flat();
      
      setState(prev => ({
        ...prev,
        query,
        results: combined,
        selectedIndex: 0,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Search error:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [providers]);
  
  // Global keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
      }
      
      // Escape to close
      if (event.key === 'Escape' && state.isOpen) {
        event.preventDefault();
        setState(prev => ({ ...prev, isOpen: false }));
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen]);
  
  // Focus input when opened
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);
  
  // Reset selection when results change
  useEffect(() => {
    setState(prev => ({ ...prev, selectedIndex: 0 }));
  }, [state.results]);
  
  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, prev.results.length - 1),
        }));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        break;
      case 'Enter':
        event.preventDefault();
        if (state.results[state.selectedIndex]) {
          handleSelect(state.results[state.selectedIndex]);
        }
        break;
    }
  };
  
  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    router.push(result.href);
    setState(prev => ({ ...prev, isOpen: false, query: '' }));
  };
  
  // Handle query change
  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    performSearch(event.target.value);
  };
  
  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${state.selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [state.selectedIndex]);
  
  if (!state.isOpen) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setState(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Palette */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <div className="glass-card overflow-hidden shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search navigation, actions..."
              value={state.query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-glass-border bg-glass/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">esc</span>
            </kbd>
          </div>
          
          {/* Results */}
          <div 
            ref={listRef}
            className="max-h-80 overflow-y-auto p-2"
          >
            {state.results.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No results found for &quot;{state.query}&quot;</p>
              </div>
            ) : (
              <div className="space-y-1">
                {state.results.map((result, index) => {
                  const Icon = result.icon;
                  const isSelected = index === state.selectedIndex;
                  
                  return (
                    <button
                      key={result.id}
                      data-index={index}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setState(prev => ({ ...prev, selectedIndex: index }))}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
                        isSelected 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-foreground hover:bg-glass/50'
                      )}
                    >
                      <div className={cn(
                        'flex items-center justify-center w-8 h-8 rounded-lg',
                        isSelected ? 'bg-primary/20' : 'bg-glass'
                      )}>
                        <Icon className={cn('w-4 h-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-medium truncate', isSelected ? 'text-primary' : '')}>
                          {result.label}
                        </p>
                        {result.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {result.description}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-primary animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-glass-border bg-glass/30 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-glass border border-glass-border font-mono">↑↓</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-glass border border-glass-border font-mono">↵</kbd>
                select
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>K to toggle</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to register additional search providers
export function useSearchProviders() {
  const [providers, setProviders] = useState<SearchProvider[]>([defaultSearchProvider]);
  
  const registerProvider = useCallback((provider: SearchProvider) => {
    setProviders(prev => {
      if (prev.some(p => p.id === provider.id)) {
        return prev;
      }
      return [...prev, provider];
    });
  }, []);
  
  const unregisterProvider = useCallback((providerId: string) => {
    setProviders(prev => prev.filter(p => p.id !== providerId));
  }, []);
  
  return {
    providers,
    registerProvider,
    unregisterProvider,
  };
}

export type { SearchResult, SearchProvider };
