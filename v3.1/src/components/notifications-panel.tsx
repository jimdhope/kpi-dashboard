"use client";

import { useState } from "react";
import { AppNotification } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, Trash2, CheckCheck } from "lucide-react";

interface NotificationsPanelProps {
  initialNotifications: AppNotification[];
}

export function NotificationsPanel({ initialNotifications }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
    });

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              readAt: notification.readAt ?? new Date().toISOString(),
            }
          : notification,
      ),
    );
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", {
      method: "PATCH",
    });

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
  }

  async function deleteNotification(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
    });

    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }

  return (
    <Card className="glass-card max-w-4xl mx-auto">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex flex-col gap-1">
          <CardTitle>Inbox</CardTitle>
          <CardDescription>
            {notifications.length} total, {unreadCount} unread
          </CardDescription>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notifications yet.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex flex-col gap-2 p-4 rounded-lg border transition-colors ${
                    notification.readAt
                      ? "bg-muted/30 border-border opacity-70"
                      : "bg-card/50 border-border hover:bg-card/80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{notification.title}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                            notification.priority === "high"
                              ? "bg-destructive/20 text-destructive"
                              : notification.priority === "medium"
                              ? "bg-yellow-500/20 text-yellow-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {notification.priority}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(notification.createdAt).toLocaleString()} ·{" "}
                        {notification.type}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!notification.readAt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => markRead(notification.id)}
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteNotification(notification.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
