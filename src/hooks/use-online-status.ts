'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UseOnlineStatusOptions {
  /** Time in ms to wait before confirming offline status (default: 2000) */
  debounceDelay?: number;
  /** Time in ms to wait before confirming online status (default: 1000) */
  stabilizeDelay?: number;
}

interface UseOnlineStatusReturn {
  isOnline: boolean;
  isOffline: boolean;
  isPending: boolean;
  wasOffline: boolean;
}

/**
 * Hook to track online/offline status with debouncing to prevent
 * flickering on brief connection drops.
 * 
 * Uses navigator.onLine combined with 'online' and 'offline' events,
 * with stabilization delays to handle edge cases like:
 * - Brief disconnections during WiFi handoff
 * - Airplane mode toggling
 * - Network instability
 */
export function useOnlineStatus(options: UseOnlineStatusOptions = {}): UseOnlineStatusReturn {
  const { debounceDelay = 2000, stabilizeDelay = 1000 } = options;
  
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const clearTimers = useCallback(() => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    if (onlineTimerRef.current) {
      clearTimeout(onlineTimerRef.current);
      onlineTimerRef.current = null;
    }
  }, []);
  
  const handleOffline = useCallback(() => {
    clearTimers();
    setWasOffline(true);
    setIsPending(true);
    
    // Debounce: wait before confirming offline status
    pendingTimerRef.current = setTimeout(() => {
      setIsOnline(false);
      setIsPending(false);
    }, debounceDelay);
  }, [debounceDelay, clearTimers]);
  
  const handleOnline = useCallback(() => {
    clearTimers();
    
    // Stabilize: if we were pending offline, wait a bit to confirm we're really online
    if (isPending || isOnline === false) {
      onlineTimerRef.current = setTimeout(() => {
        setIsOnline(true);
        setIsPending(false);
      }, stabilizeDelay);
    } else {
      setIsOnline(true);
    }
  }, [isPending, isOnline, stabilizeDelay, clearTimers]);
  
  useEffect(() => {
    // Initialize with current status
    setIsOnline(navigator.onLine);
    
    // Add event listeners
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearTimers();
    };
  }, [handleOffline, handleOnline, clearTimers]);
  
  return {
    isOnline: isOnline ?? true,
    isOffline: !isPending && isOnline === false,
    isPending,
    wasOffline,
  };
}
