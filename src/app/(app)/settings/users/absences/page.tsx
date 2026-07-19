"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type User = { id: string; name: string };
type Absence = { id: string; userName: string; startsOn: string; endsOn?: string | null; reason?: string | null };

export default function AbsencesPage() {
  const { toast } = useToast(); const [users, setUsers] = useState<User[]>([]); const [absences, setAbsences] = useState<Absence[]>([]); const [userId, setUserId] = useState(""); const [startsOn, setStartsOn] = useState(""); const [endsOn, setEndsOn] = useState(""); const [endUnknown, setEndUnknown] = useState(false); const [reason, setReason] = useState("");
  const load = async () => { const [usersResult, absenceResult] = await Promise.all([fetch('/api/users'), fetch('/api/absences')]); if (usersResult.ok) { const data = await usersResult.json(); setUsers(data.users || []); } if (absenceResult.ok) { const data = await absenceResult.json(); setAbsences(data.absences || []); } };
  useEffect(() => { load().catch(() => undefined); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch('/api/absences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, startsOn: new Date(`${startsOn}T00:00:00Z`).toISOString(), endsOn: endUnknown ? null : new Date(`${endsOn}T23:59:59Z`).toISOString(), reason: reason || null }) }); const data = await response.json(); if (!response.ok) { toast({ variant: 'destructive', title: 'Absence not saved', description: data.error }); return; } setUserId(''); setStartsOn(''); setEndsOn(''); setEndUnknown(false); setReason(''); await load(); toast({ title: 'Absence recorded' }); };
  return <div className="mx-auto max-w-4xl space-y-6"><div><h1 className="text-3xl font-bold">Absences</h1><p className="text-muted-foreground">Record leave without changing competition enrolment or earned scores.</p></div><Card><CardHeader><CardTitle>Record absence</CardTitle></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-2" onSubmit={submit}><Select value={userId} onValueChange={setUserId}><SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger><SelectContent>{users.map(user => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><div className="grid grid-cols-2 gap-3"><Input type="date" value={startsOn} onChange={e=>setStartsOn(e.target.value)} required/><Input type="date" value={endsOn} onChange={e=>setEndsOn(e.target.value)} required disabled={endUnknown}/></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={endUnknown} onCheckedChange={(checked) => setEndUnknown(checked === true)}/>End date unknown</label><Textarea className="md:col-span-2" value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason (optional)"/><Button className="md:col-span-2 md:w-fit" disabled={!userId||!startsOn||(!endUnknown&&!endsOn)}>Save absence</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Recorded absences</CardTitle></CardHeader><CardContent className="space-y-2">{absences.length===0?<p className="text-sm text-muted-foreground">No absences recorded.</p>:absences.map(absence=><div key={absence.id} className="rounded border p-3"><b>{absence.userName}</b><span className="ml-2 text-sm text-muted-foreground">{new Date(absence.startsOn).toLocaleDateString()} – {absence.endsOn ? new Date(absence.endsOn).toLocaleDateString() : 'Unknown'}</span>{absence.reason&&<p className="mt-1 text-sm">{absence.reason}</p>}</div>)}</CardContent></Card></div>;
}
