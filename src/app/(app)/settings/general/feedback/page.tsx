"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Item = {
  id: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  staffReply?: string | null;
  repliedAt?: string | null;
  user?: { name: string; email: string } | null;
  attachments?: { originalName: string; storedName: string; size: number }[];
};

export default function FeedbackTriagePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const response = await fetch("/api/feedback?all=true");
    const data = response.ok ? await response.json() : { feedback: [] };
    setItems(data.feedback || []);
    setReplyDrafts(Object.fromEntries((data.feedback || []).map((item: Item) => [item.id, item.staffReply || ""])));
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const response = await fetch(`/api/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) toast({ variant: "destructive", title: "Status not updated", description: "Please try again." });
    else void load();
  };

  const saveReply = async (id: string) => {
    const staffReply = replyDrafts[id]?.trim();
    if (!staffReply) return;
    setSavingId(id);
    try {
      const response = await fetch(`/api/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffReply }) });
      if (!response.ok) throw new Error();
      await load();
      toast({ title: "Reply sent", description: "The person who submitted this feedback has been notified." });
    } catch {
      toast({ variant: "destructive", title: "Reply not sent", description: "Please try again." });
    } finally {
      setSavingId(null);
    }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-3xl font-bold">Feedback triage</h1><p className="text-muted-foreground">Review feedback, reply to the sender, and track progress.</p></div>
    <Card><CardContent className="space-y-3 pt-6">
      {items.length === 0 ? <p className="text-muted-foreground">No feedback submitted.</p> : items.map((item) => <div className="rounded border p-4" key={item.id}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row"><div><b>{item.subject}</b><p className="text-xs text-muted-foreground">{item.user?.name || "Unknown"} · {new Date(item.createdAt).toLocaleString()}</p></div><Select value={item.status} onValueChange={(value) => void updateStatus(item.id, value)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NEW">New</SelectItem><SelectItem value="IN_PROGRESS">In progress</SelectItem><SelectItem value="RESOLVED">Resolved</SelectItem></SelectContent></Select></div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{item.message}</p>
        {item.attachments?.length ? <div className="mt-2 flex flex-wrap gap-2">{item.attachments.map((attachment) => <a key={attachment.storedName} className="text-xs text-primary underline underline-offset-2" href={`/api/feedback/${item.id}/attachments/${encodeURIComponent(attachment.storedName)}`}>{attachment.originalName} ({Math.ceil(attachment.size / 1024)} KB)</a>)}</div> : null}
        <div className="mt-4 border-t pt-4"><label className="mb-2 block text-sm font-medium" htmlFor={`reply-${item.id}`}>{item.staffReply ? "Update reply" : "Reply to sender"}</label><Textarea id={`reply-${item.id}`} value={replyDrafts[item.id] ?? ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={4_000} placeholder="Write a response the sender can see…" className="min-h-24" /><div className="mt-2 flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{item.repliedAt ? `Last sent ${new Date(item.repliedAt).toLocaleString()}` : "The sender will receive a notification."}</p><Button size="sm" onClick={() => void saveReply(item.id)} disabled={!replyDrafts[item.id]?.trim() || savingId === item.id}>{savingId === item.id ? "Sending…" : item.staffReply ? "Update reply" : "Send reply"}</Button></div></div>
      </div>)}
    </CardContent></Card>
  </div>;
}
