'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface Notification {
  id: string;
  type: 'notification' | 'unread_count' | 'connection' | 'error';
  title?: string;
  message?: string;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  createdAt?: string;
  count?: number;
  timestamp?: string;
}

interface UseNotificationSSEOptions {
  onNotification?: (notification: Notification) => void;
  onUnreadCount?: (count: number) => void;
  onConnection?: (status: 'connected' | 'disconnected' | 'error') => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number; // ms, default 5000
  maxRetries?: number; // default 10
}

interface UseNotificationSSEReturn {
  isConnected: boolean;
  unreadCount: number;
  lastNotification: Notification | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useNotificationSSE(
  options: UseNotificationSSEOptions = {}
): UseNotificationSSEReturn {
  const {
    onNotification,
    onUnreadCount,
    onConnection,
    onError,
    reconnectInterval = 5000,
    maxRetries = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastNotification, setLastNotification] = useState<Notification | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsConnected(false);
    onConnection?.('disconnected');
  }, [onConnection]);

  const connect = useCallback(() => {
    // Don't connect if unmounted or already connected
    if (!isMountedRef.current) return;
    if (eventSourceRef.current?.readyState === EventSource.OPEN) return;

    disconnect(); // Clean up any existing connection

    const eventSource = new EventSource('/api/notifications/sse');
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.onopen = () => {
      if (!isMountedRef.current) return;
      setIsConnected(true);
      retryCountRef.current = 0;
      onConnection?.('connected');
    };

    // Handle notification events
    eventSource.addEventListener('notification', (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data) as Notification;
        data.type = 'notification';
        data.timestamp = data.timestamp || new Date().toISOString();
        setLastNotification(data);
        onNotification?.(data);
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    });

    // Handle unread count events
    eventSource.addEventListener('unread_count', (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        const count = data.count ?? 0;
        setUnreadCount(count);
        onUnreadCount?.(count);
      } catch (error) {
        console.error('Error parsing unread count:', error);
      }
    });

    // Handle connection events
    eventSource.addEventListener('connection', (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'connected') {
          setIsConnected(true);
          onConnection?.('connected');
        }
      } catch (error) {
        console.error('Error parsing connection event:', error);
      }
    });

    // Handle errors
    eventSource.onerror = (error) => {
      if (!isMountedRef.current) return;

      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      onError?.(error);
      onConnection?.('error');

      // Retry with exponential backoff
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(reconnectInterval * retryCountRef.current, 30000);
        console.log(`[SSE] Connection lost. Retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
        retryTimeoutRef.current = setTimeout(connect, delay);
      } else {
        console.error('[SSE] Max retries reached. Giving up.');
        onConnection?.('error');
      }
    };
  }, [disconnect, onNotification, onUnreadCount, onConnection, onError, reconnectInterval, maxRetries]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    unreadCount,
    lastNotification,
    reconnect,
    disconnect,
  };
}

/**
 * Hook to manage push notification subscription
 */
export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Check if push is supported
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
    }
  }, []);

  // Check subscription status
  const checkSubscription = useCallback(async () => {
    if (!isSupported) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/notifications/subscribe');
      if (response.ok) {
        const data = await response.json();
        setPublicKey(data.publicKey);
        setIsSubscribed(data.subscribed);
      }
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError('Failed to check subscription status');
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !publicKey) {
      setError('Push notifications are not supported or not configured');
      return false;
    }

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/push-sw.js', {
        scope: '/',
      });

      // Get push subscription
      let subscription = await registration.pushManager.getSubscription();

      // If no subscription exists, create one
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      // Send subscription to server
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        setError(null);
        return true;
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (err) {
      console.error('Error subscribing:', err);
      setError(err instanceof Error ? err.message : 'Failed to subscribe');
      return false;
    }
  }, [isSupported, publicKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      const response = await fetch('/api/notifications/unsubscribe', {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsSubscribed(false);
        setError(null);
        return true;
      } else {
        throw new Error('Failed to unsubscribe');
      }
    } catch (err) {
      console.error('Error unsubscribing:', err);
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
      return false;
    }
  }, [isSupported]);

  return {
    isSubscribed,
    publicKey,
    isLoading,
    error,
    isSupported,
    subscribe,
    unsubscribe,
    checkSubscription,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
