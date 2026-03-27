'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, CheckCheck, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSSE, usePushSubscription } from '@/hooks/use-notification-sse';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  actionUrl?: string;
  createdAt: string;
  readAt?: string | null;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const typeIcons: Record<string, string> = {
  competition_reminder: '🏆',
  score_achievement: '⭐',
  team_update: '👥',
  system_alert: '🔔',
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // SSE connection for real-time updates
  const { unreadCount, isConnected, lastNotification } = useNotificationSSE({
    onNotification: (notification) => {
      if (notification.type === 'notification') {
        // Add new notification to the list
        setNotifications((prev) => [
          {
            id: notification.id || `notif-${Date.now()}`,
            title: notification.title || 'New Notification',
            message: notification.message || '',
            type: notification.type || 'system_alert',
            priority: (notification.priority as 'low' | 'medium' | 'high') || 'medium',
            actionUrl: notification.actionUrl,
            createdAt: notification.createdAt || notification.timestamp || new Date().toISOString(),
          },
          ...prev.slice(0, 49), // Keep last 50 notifications
        ]);
        
        // Show toast for new notification
        toast({
          title: notification.title || 'New Notification',
          description: notification.message,
          duration: 5000,
        });
      }
    },
    onUnreadCount: (count) => {
      // Update badge count
    },
    onConnection: (status) => {
      console.log('[NotificationBell] SSE status:', status);
    },
  });

  // Fetch initial notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNotifications();
  }, []);

  // Mark single notification as read
  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
        );
        toast({ title: 'All notifications marked as read' });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative flex items-center justify-center h-9 w-9 px-0"
        >
          {isConnected ? (
            <BellRing className="w-5 h-5 text-muted-foreground" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="mr-1 h-3 w-3" />
                Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <Link href="/settings/notifications" onClick={() => setIsOpen(false)}>
                <Settings className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'relative px-4 py-3 transition-colors hover:bg-muted/50',
                    !notification.readAt && 'bg-muted/20'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl" title={notification.type}>
                      {typeIcons[notification.type] || '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                        {notification.priority === 'high' && (
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1', priorityColors.high)}
                          >
                            High
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.readAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => markAsRead(notification.id)}
                          title="Mark as read"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => deleteNotification(notification.id)}
                        title="Delete"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-4 py-2">
          <p className="text-[10px] text-muted-foreground text-center">
            {isConnected ? (
              <span className="text-green-600">● Connected</span>
            ) : (
              <span className="text-red-600">● Disconnected</span>
            )}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}
