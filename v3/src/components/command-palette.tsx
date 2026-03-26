'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Trophy, Target, BarChart3, Gamepad2, Settings, Shield, Home, Command, ArrowRight, CheckSquare, Award, LineChart, Megaphone, Users, BookOpen, UserCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

// Search result type
interface SearchResult {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href: string;
  category: 'navigation' | 'action' | 'data' | 'wiki' | 'contacts';
}

// Search providers interface - allows for future extensibility
interface SearchProvider {
  id: string;
  name: string;
  search: (query: string) => Promise<SearchResult[]>;
}

// Navigation routes with all dropdown items
const navigationRoutes: SearchResult[] = [
  // Main section items
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
    href: '/settings/general',
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
  
  // Competitions sub-items
  {
    id: 'comp-dashboard',
    label: 'Competitions > Dashboard',
    description: 'View competitions overview',
    icon: Home,
    href: '/competitions',
    category: 'navigation',
  },
  {
    id: 'comp-log',
    label: 'Competitions > Log Scores',
    description: 'Log your competition scores',
    icon: CheckSquare,
    href: '/competitions/log',
    category: 'navigation',
  },
  {
    id: 'comp-manage',
    label: 'Competitions > Manage',
    description: 'Manage competitions',
    icon: Trophy,
    href: '/competitions/manage',
    category: 'navigation',
  },
  {
    id: 'comp-certificates',
    label: 'Competitions > Certificates',
    description: 'View earned certificates',
    icon: Award,
    href: '/competitions/certificates',
    category: 'navigation',
  },
  
  // Trackers sub-items
  {
    id: 'trackers-dashboard',
    label: 'Trackers > Dashboard',
    description: 'View trackers overview',
    icon: Home,
    href: '/trackers',
    category: 'navigation',
  },
  {
    id: 'trackers-setup',
    label: 'Trackers > Setup Trackers',
    description: 'Configure your trackers',
    icon: Settings,
    href: '/trackers/setup',
    category: 'navigation',
  },
  {
    id: 'trackers-log',
    label: 'Trackers > Log Scores',
    description: 'Log tracker scores',
    icon: CheckSquare,
    href: '/trackers/log',
    category: 'navigation',
  },
  
  // Performance sub-items
  {
    id: 'perf-dashboard',
    label: 'Performance > Dashboard',
    description: 'View performance overview',
    icon: Home,
    href: '/performance',
    category: 'navigation',
  },
  {
    id: 'perf-kpis',
    label: 'Performance > Setup KPIs',
    description: 'Configure KPI definitions',
    icon: Settings,
    href: '/performance/kpis',
    category: 'navigation',
  },
  {
    id: 'perf-log',
    label: 'Performance > Log Scores',
    description: 'Log performance scores',
    icon: CheckSquare,
    href: '/performance/log',
    category: 'navigation',
  },
  {
    id: 'perf-breakdown',
    label: 'Performance > KPI Breakdown',
    description: 'Detailed KPI analysis',
    icon: BarChart3,
    href: '/performance/breakdown',
    category: 'navigation',
  },
  {
    id: 'perf-charts',
    label: 'Performance > Performance Charts',
    description: 'View performance visualizations',
    icon: LineChart,
    href: '/performance/charts',
    category: 'navigation',
  },
  
  // Settings sub-items
  {
    id: 'settings-general',
    label: 'Settings > General',
    description: 'General settings',
    icon: Settings,
    href: '/settings/general',
    category: 'navigation',
  },
  {
    id: 'settings-campaigns',
    label: 'Settings > Campaigns',
    description: 'Manage campaigns',
    icon: Megaphone,
    href: '/settings/campaigns',
    category: 'navigation',
  },
  {
    id: 'settings-pods',
    label: 'Settings > Pods',
    description: 'Manage pods',
    icon: Shield,
    href: '/settings/pods',
    category: 'navigation',
  },
  {
    id: 'settings-users',
    label: 'Settings > Users',
    description: 'Manage users',
    icon: Users,
    href: '/settings/users',
    category: 'navigation',
  },
  
  // Mini Games sub-items
  {
    id: 'minigames-dashboard',
    label: 'Mini Games > Dashboard',
    description: 'View mini games overview',
    icon: Home,
    href: '/mini-games',
    category: 'navigation',
  },
    {
    id: 'minigames-rps',
    label: 'Mini Games > RPS Game',
    description: 'Play Rock Paper Scissors',
    icon: Gamepad2,
    href: '/mini-games/rps',
    category: 'navigation',
  },
  
  // Activity History
  {
    id: 'agent-activity',
    label: 'Activity History',
    description: 'View your activity timeline',
    icon: Activity,
    href: '/agent/activity',
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

// Wiki search provider - placeholder stub for future implementation
const wikiSearchProvider: SearchProvider = {
  id: 'wiki',
  name: 'Wiki',
  search: async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      // Show placeholder items when no query
      return [
        {
          id: 'wiki-placeholder',
          label: 'Wiki Articles',
          description: 'Search knowledge base articles',
          icon: BookOpen,
          href: '/wiki',
          category: 'wiki',
        },
      ];
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Placeholder articles - replace with actual API call when backend is ready
    const wikiPlaceholders: SearchResult[] = [
      {
        id: 'wiki-getting-started',
        label: 'Getting Started Guide',
        description: 'Learn how to use KPI Quest',
        icon: BookOpen,
        href: '/wiki/getting-started',
        category: 'wiki',
      },
      {
        id: 'wiki-kpi-setup',
        label: 'Setting Up KPIs',
        description: 'How to configure and track KPIs',
        icon: BookOpen,
        href: '/wiki/kpi-setup',
        category: 'wiki',
      },
      {
        id: 'wiki-competitions',
        label: 'Running Competitions',
        description: 'Tips for successful competitions',
        icon: BookOpen,
        href: '/wiki/competitions',
        category: 'wiki',
      },
    ];
    
    return wikiPlaceholders.filter(
      (article) =>
        article.label.toLowerCase().includes(lowerQuery) ||
        article.description?.toLowerCase().includes(lowerQuery)
    );
  },
};

// Contacts search provider - placeholder stub for future implementation
const contactsSearchProvider: SearchProvider = {
  id: 'contacts',
  name: 'Contacts',
  search: async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) {
      // Show placeholder item when no query
      return [
        {
          id: 'contacts-placeholder',
          label: 'Team Contacts',
          description: 'Search team members and contacts',
          icon: UserCircle,
          href: '/contacts',
          category: 'contacts',
        },
      ];
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Placeholder contacts - replace with actual API call when backend is ready
    const contactsPlaceholders: SearchResult[] = [
      {
        id: 'contacts-team',
        label: 'Team Directory',
        description: 'Browse all team members',
        icon: UserCircle,
        href: '/contacts/team',
        category: 'contacts',
      },
      {
        id: 'contacts-admin',
        label: 'Contact Admin',
        description: 'Reach out to your team admin',
        icon: UserCircle,
        href: '/contacts/admin',
        category: 'contacts',
      },
    ];
    
    return contactsPlaceholders.filter(
      (contact) =>
        contact.label.toLowerCase().includes(lowerQuery) ||
        contact.description?.toLowerCase().includes(lowerQuery)
    );
  },
};

// Category display names and order
const categoryConfig: Record<SearchResult['category'], { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  action: { label: 'Actions', order: 2 },
  data: { label: 'Data', order: 3 },
  wiki: { label: 'Wiki', order: 4 },
  contacts: { label: 'Contacts', order: 5 },
};

// Group results by category with section headers
interface GroupedResults {
  type: 'header' | 'result';
  category?: SearchResult['category'];
  label?: string;
  result?: SearchResult;
  index?: number;
}

function groupResultsByCategory(results: SearchResult[]): GroupedResults[] {
  const grouped: Map<SearchResult['category'], SearchResult[]> = new Map();
  
  // Group results by category
  results.forEach(result => {
    const existing = grouped.get(result.category) || [];
    grouped.set(result.category, [...existing, result]);
  });
  
  // Sort categories and build flat list with headers
  const sortedCategories = [...grouped.entries()]
    .sort((a, b) => categoryConfig[a[0]].order - categoryConfig[b[0]].order);
  
  const flatList: GroupedResults[] = [];
  let globalIndex = 0;
  
  sortedCategories.forEach(([category, categoryResults]) => {
    // Add section header
    flatList.push({
      type: 'header',
      category,
      label: categoryConfig[category].label,
    });
    
    // Add results in this category
    categoryResults.forEach(result => {
      flatList.push({
        type: 'result',
        result,
        index: globalIndex++,
      });
    });
  });
  
  return flatList;
}

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
  const [providers] = useState<SearchProvider[]>([
    defaultSearchProvider,
    wikiSearchProvider,
    contactsSearchProvider,
  ]);
  
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
              placeholder="Search navigation, wiki, contacts..."
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
                {groupResultsByCategory(state.results).map((item, idx) => {
                  // Render section header
                  if (item.type === 'header') {
                    return (
                      <div
                        key={`header-${item.category}`}
                        className="px-3 py-1.5 mt-2 first:mt-0 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        {item.label}
                      </div>
                    );
                  }
                  
                  // Render result item
                  const result = item.result!;
                  const Icon = result.icon;
                  const isSelected = item.index === state.selectedIndex;
                  
                  // Add visual distinction for placeholder/wip categories
                  const isPlaceholder = result.category === 'wiki' || result.category === 'contacts';
                  
                  return (
                    <button
                      key={result.id}
                      data-index={item.index}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setState(prev => ({ ...prev, selectedIndex: item.index! }))}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 text-left',
                        isSelected 
                          ? 'bg-primary/20 text-primary' 
                          : 'text-foreground hover:bg-glass/50',
                        isPlaceholder && !isSelected && 'opacity-70'
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
                          {isPlaceholder && (
                            <span className="ml-2 text-xs text-muted-foreground/50">(coming soon)</span>
                          )}
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
  const [providers, setProviders] = useState<SearchProvider[]>([
    defaultSearchProvider,
    wikiSearchProvider,
    contactsSearchProvider,
  ]);
  
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
