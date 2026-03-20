'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bell, CheckCheck, Trash2, Settings, 
  Trophy, Award, Users, AlertCircle, 
  Clock, Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from './notificationStore';
import { NotificationItem } from './NotificationItem';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Lock body scroll when dropdown is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNotificationClick = (notification: Notification) => {
    if (notification.actionUrl) {
      onClose();
    }
  };

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute right-0 top-full mt-2 z-[100]',
        'w-[380px] max-h-[520px]',
        'glass-dropdown rounded-xl overflow-hidden',
        'animate-in fade-in slide-in-from-top-2 duration-200'
      )}
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border/60">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            asChild
          >
            <Link href="/settings/notifications" onClick={onClose}>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No notifications</h4>
            <p className="text-sm text-muted-foreground text-center">
              You&apos;re all caught up! Check back later for updates.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
                onClick={handleNotificationClick}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-glass-border/60 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
            onClick={clearAllNotifications}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            asChild
          >
            <Link href="/settings/notifications" onClick={onClose}>
              Notification settings
            </Link>
          </Button>
        </div>
      )}

      {/* Type indicators legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-glass-border/40 bg-muted/10">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Trophy className="h-3 w-3 text-amber-500" />
          <span>Competitions</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Award className="h-3 w-3 text-emerald-500" />
          <span>Achievements</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3 text-blue-500" />
          <span>Team</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span>Alerts</span>
        </div>
      </div>
    </div>
  );
}
