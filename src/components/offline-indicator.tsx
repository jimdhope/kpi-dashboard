'use client';

import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOnlineStatus } from '@/hooks/use-online-status';

interface OfflineIndicatorProps {
  /** Custom class name */
  className?: string;
  /** Whether to show a subtle pulse animation when offline */
  pulseAnimation?: boolean;
  /** Custom message to display when offline */
  offlineMessage?: string;
  /** Whether to show a reconnection hint */
  showReconnectHint?: boolean;
}

/**
 * OfflineIndicator - A banner that appears when the user goes offline
 * 
 * Features:
 * - Appears at the top of the screen with smooth animation
 * - Uses amber/yellow warning colors for visibility
 * - Includes wifi-off icon from lucide-react
 * - Auto-dismisses when connection is restored
 * - Debounced state changes to prevent flickering on brief disconnections
 * - Responsive design that works on mobile
 * - Glass styling for visual consistency with the app
 * 
 * @example
 * ```tsx
 * // Basic usage - just drop it in your layout
 * <OfflineIndicator />
 * 
 * // With custom message
 * <OfflineIndicator offlineMessage="You're offline - data won't be saved" />
 * ```
 */
export function OfflineIndicator({
  className,
  pulseAnimation = true,
  offlineMessage = "You're offline — some features may be unavailable",
  showReconnectHint = true,
}: OfflineIndicatorProps) {
  const { isOffline, wasOffline, isPending } = useOnlineStatus();
  
  // Don't show if never went offline or if we're pending confirmation
  // But show if we're confirmed offline OR if we recently went offline (for animation)
  if (!isOffline && !wasOffline && !isPending) {
    return null;
  }
  
  // Wait a bit before hiding to show the transition out
  const shouldShow = isOffline || isPending;
  
  if (!shouldShow) {
    return null;
  }
  
  return (
    <div
      className={cn(
        "fixed top-[65px] left-0 right-0 z-40",
        "flex items-center justify-center gap-3 px-4 py-3",
        "bg-gradient-to-r from-amber-500/90 via-amber-400/90 to-amber-500/90",
        "border-b border-amber-600/30",
        "shadow-lg shadow-amber-500/20",
        "transition-all duration-300 ease-out",
        "dark:from-amber-600/95 dark:via-amber-500/95 dark:to-amber-600/95",
        "dark:border-amber-500/40 dark:shadow-amber-600/20",
        pulseAnimation && isOffline && "animate-pulse",
        className
      )}
      role="alert"
      aria-live="assertive"
      aria-label="Network status indicator"
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 p-1.5 rounded-full",
          "bg-amber-600/30 dark:bg-amber-700/40",
          "transition-transform duration-300",
          isPending && "animate-pulse"
        )}
      >
        {isPending ? (
          <RefreshCw className="w-4 h-4 text-amber-50 animate-spin" />
        ) : (
          <WifiOff className="w-4 h-4 text-amber-50" />
        )}
      </div>
      
      {/* Message */}
      <p className="text-sm font-medium text-amber-50 text-center">
        {isPending ? "Checking connection..." : offlineMessage}
      </p>
      
      {/* Reconnect hint */}
      {showReconnectHint && !isPending && (
        <span className="text-xs text-amber-100/80 ml-1 hidden sm:inline">
          We'll reconnect automatically
        </span>
      )}
    </div>
  );
}

/**
 * Hook version for more control over the offline state
 * Returns the same values as useOnlineStatus hook
 */
export { useOnlineStatus } from '@/hooks/use-online-status';
