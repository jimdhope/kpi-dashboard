'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Notification = { id: string; title: string; message: string; href?: string | null; readAt?: string | null; createdAt: string };

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = () => fetch('/api/notifications').then((response) => response.ok ? response.json() : { notifications: [], unreadCount: 0 }).then((data) => { setItems(data.notifications ?? []); setUnreadCount(data.unreadCount ?? 0); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const markAllRead = async () => { await fetch('/api/notifications', { method: 'PATCH' }); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() }))); setUnreadCount(0); };
  return <div className="mx-auto max-w-3xl space-y-6"><Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle><CardDescription>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You are all caught up.'}</CardDescription></div><Button variant="outline" onClick={markAllRead} disabled={!unreadCount}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button></CardHeader><CardContent className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">Loading notifications…</p> : !items.length ? <p className="py-8 text-center text-sm text-muted-foreground">No notifications yet.</p> : items.map((item) => { const content=<><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></>; return item.href ? <Link key={item.id} href={item.href} className={`block rounded-lg border p-4 transition-colors hover:bg-muted/50 ${!item.readAt ? 'border-primary/40 bg-primary/5' : ''}`}>{content}</Link> : <div key={item.id} className={`rounded-lg border p-4 ${!item.readAt ? 'border-primary/40 bg-primary/5' : ''}`}>{content}</div>; })}</CardContent></Card></div>;
}
