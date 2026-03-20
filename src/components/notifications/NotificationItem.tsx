'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Trophy, Target, Users, AlertCircle, Award, 
  TrendingUp, CheckCircle, Clock, MessageSquare, 
  Zap, X, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  Notification, 
  notificationIcons, 
  notificationColors,
  priorityColors,
  formatRelativeTime,
  formatFullDate 
} from './notificationStore';
import { Button } from '@/components/ui/button';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (notification: Notification) => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const Icon = notificationIcons[notification.type];
  const colors = notificationColors[notification.type];
  const priorityColor = priorityColors[notification.priority];

  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead?.(notification.id);
    }
    onClick?.(notification);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(notification.id);
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkAsRead?.(notification.id);
  };

  return (
    <div
      className={cn(
        'relative group p-3 transition-all duration-200 cursor-pointer',
        'border-b border-border/30 last:border-b-0',
        notification.read 
          ? 'bg-transparent hover:bg-accent/20' 
          : 'bg-accent/10 hover:bg-accent/20',
        'animate-in fade-in slide-in-from-top-2 duration-200'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Unread indicator dot */}
      {!notification.read && (
        <div 
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full',
            priorityColor
          )}
        />
      )}

      <div className={cn('flex items-start gap-3 pl-4', !notification.read && '-ml-0')}>
        {/* Icon */}
        <div 
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            colors.bg
          )}
        >
          <Icon className={cn('w-5 h-5', colors.icon)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              'text-sm font-medium leading-tight',
              notification.read ? 'text-foreground' : 'text-foreground'
            )}>
              {notification.title}
            </h4>
            
            {/* Action buttons */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleMarkAsRead}
                  title="Mark as read"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDelete}
                title="Delete"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.timestamp)}
            </span>
            
            {notification.actionUrl && (
              <Link 
                href={notification.actionUrl}
                className="text-xs text-primary hover:underline flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                View
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Priority indicator */}
      {notification.priority === 'high' && (
        <div className="absolute right-2 top-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-600 dark:text-red-400">
            Urgent
          </span>
        </div>
      )}
    </div>
  );
}
