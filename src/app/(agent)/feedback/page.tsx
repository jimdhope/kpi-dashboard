"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Paperclip } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Feedback = { id: string; subject: string; message: string; status: string; createdAt: string; staffReply?: string | null; repliedAt?: string | null };

export default function FeedbackPage() {
  const { toast } = useToast();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  const loadFeedback = () => fetch("/api/feedback").then((response) => response.ok ? response.json() : { feedback: [] }).then((data) => setFeedback(data.feedback || [])).catch(() => undefined);
  useEffect(() => { loadFeedback(); }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const body = new FormData(); body.set("subject", subject); body.set("message", message);
      Array.from(files || []).forEach((file) => body.append("files", file));
      const response = await fetch("/api/feedback", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to submit feedback.");
      setSubject(""); setMessage(""); setFiles(null);
      const input = document.getElementById("feedback-files") as HTMLInputElement | null; if (input) input.value = "";
      await loadFeedback();
      toast({ title: "Feedback submitted", description: "Thank you—we have recorded it." });
    } catch (error) { toast({ variant: "destructive", title: "Feedback not submitted", description: error instanceof Error ? error.message : "Please try again." }); }
    finally { setSubmitting(false); }
  }

  return <main className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
    <div><h1 className="text-3xl font-bold">Feedback</h1><p className="text-muted-foreground">Share an issue, idea, or improvement with the KPI Quest team.</p></div>
    <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5" />Send feedback</CardTitle><CardDescription>PDF, image, or text attachments are accepted (up to three files, 10 MB each).</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={submit}><Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} placeholder="What is this about?" required /><Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} placeholder="Tell us what happened or what would improve the experience…" required className="min-h-32" /><div><label htmlFor="feedback-files" className="mb-1 block text-sm font-medium">Attachments (optional)</label><Input id="feedback-files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.txt" onChange={(event) => setFiles(event.target.files)} /></div><Button type="submit" disabled={submitting}>{submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : 'Submit feedback'}</Button></form></CardContent></Card>
    {feedback.length > 0 && <Card><CardHeader><CardTitle className="text-base">Your submissions</CardTitle></CardHeader><CardContent className="space-y-3">{feedback.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="font-medium">{item.subject}</p><span className="text-xs text-muted-foreground">{item.status.replace("_", " ")}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>{item.staffReply ? <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3"><p className="text-sm font-medium">Reply from KPI Quest</p><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.staffReply}</p>{item.repliedAt ? <p className="mt-2 text-xs text-muted-foreground">{new Date(item.repliedAt).toLocaleString()}</p> : null}</div> : null}<p className="mt-2 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div>)}</CardContent></Card>}
  </main>;
}
