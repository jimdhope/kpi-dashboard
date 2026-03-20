'use client';

import React from 'react';
import { 
  Bell, Clock, CheckCheck, Trash2, 
  Trophy, Award, Users, AlertCircle,
  Settings, Inbox
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  useNotifications, 
  notificationIcons, 
  notificationColors,
  formatRelativeTime,
  formatFullDate,
  NotificationType
} from '@/components/notifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';

export default function NotificationSettingsPage() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  // Group notifications by type
  const notificationsByType = notifications.reduce((acc, notification) => {
    if (!acc[notification.type]) {
      acc[notification.type] = [];
    }
    acc[notification.type].push(notification);
    return acc;
  }, {} as Record<NotificationType, typeof notifications>);

  // Notification type labels
  const typeLabels: Record<NotificationType, string> = {
    competition_reminder: 'Competition Reminders',
    score_achievement: 'Achievements',
    team_update: 'Team Updates',
    system_alert: 'System Alerts',
  };

  // Notification type descriptions
  const typeDescriptions: Record<NotificationType, string> = {
    competition_reminder: 'Get notified about upcoming competitions and deadlines',
    score_achievement: 'Celebrate your accomplishments and earned badges',
    team_update: 'Stay informed about team leaderboard changes',
    system_alert: 'Important system maintenance and updates',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Manage your notification preferences and history</p>
        </div>
        
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearAllNotifications}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notificationsByType.competition_reminder?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Competition</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <Award className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notificationsByType.score_achievement?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notificationsByType.team_update?.length || 0}</p>
              <p className="text-xs text-muted-foreground">Team</p>
            </div>
          </div>
        </Card>
        
        <Card variant="glass" className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notificationsByType.system_alert?.length || 0}</p>
              <p className="text-xs text-muted-foreground">System</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Notification Types Legend */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Notification Types</CardTitle>
          <CardDescription>
            Understanding the different types of notifications you can receive
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(notificationIcons) as NotificationType[]).map((type) => {
              const Icon = notificationIcons[type];
              const colors = notificationColors[type];
              return (
                <div 
                  key={type}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
                >
                  <div className={`p-2 rounded-lg ${colors.bg}`}>
                    <Icon className={`h-4 w-4 ${colors.icon}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{typeLabels[type]}</p>
                    <p className="text-xs text-muted-foreground">{typeDescriptions[type]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* All Notifications */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">All Notifications</CardTitle>
              <CardDescription>
                {notifications.length === 0 
                  ? 'No notifications yet' 
                  : `${notifications.length} notification${notifications.length === 1 ? '' : 's'} (${unreadCount} unread)`
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h4 className="font-medium text-foreground mb-1">No notifications</h4>
              <p className="text-sm text-muted-foreground text-center">
                You&apos;re all caught up! Check back later for updates.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="divide-y divide-border/30">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Coming Soon Features */}
      <Card variant="glass" className="border-dashed">
        <CardHeader className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-primary/10">
              <Settings className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl mb-2">Advanced Settings Coming Soon</CardTitle>
          <p className="text-muted-foreground max-w-md mx-auto">
            We&apos;re working on bringing you personalized notification preferences, including:
          </p>
        </CardHeader>
        <CardContent className="text-left pb-8">
          <ul className="space-y-2 max-w-md mx-auto text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Toggle notifications by type
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Set quiet hours and do not disturb times
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Email notification preferences
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Push notification settings
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Custom notification sounds
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
