'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNotifications } from './notificationStore';
import { NotificationDropdown } from './NotificationDropdown';

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { unreadCount, loading } = useNotifications();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevUnreadCount = useRef(unreadCount);

  // Animate bell when new notification arrives
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timer);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  // Close dropdown when clicking on bell button again
  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  // Close dropdown
  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        className={cn(
          'relative h-10 w-10 rounded-lg transition-all duration-200',
          isOpen 
            ? 'bg-primary/20 text-primary' 
            : 'text-muted-foreground hover:text-foreground hover:bg-glass/50',
          isAnimating && 'animate-bounce'
        )}
        onClick={handleBellClick}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className={cn(
          'h-5 w-5 transition-transform duration-200',
          isOpen && 'scale-110'
        )} />
        
        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center',
              'rounded-full text-[10px] font-bold',
              'bg-primary text-primary-foreground',
              'shadow-lg animate-in zoom-in-50 duration-200',
              'transition-transform hover:scale-110'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* Pulse effect for new notifications */}
        {unreadCount > 0 && !isAnimating && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping opacity-75" />
        )}
      </Button>

      {/* Notification Dropdown */}
      <NotificationDropdown isOpen={isOpen} onClose={handleClose} />
    </div>
  );
}
