'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type Room = {
  code: string;
  phase: 'lobby' | 'submitting' | 'voting' | 'reveal' | 'complete';
  currentRound: number;
  participantCount: number;
  totalRounds: number;
  host: { name: string; email: string };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  participants: Array<{ id: string; displayName: string; score: number; isHost: boolean }>;
  rounds: Array<{ roundNumber: number; prompt: { text: string }; completedAt: string | null }>;
  submissions: Array<{ id: string; roundNumber: number; authorName?: string; caption: string; gifTitle: string | null; voteCount: number }>;
  votes: Array<{ id: string; roundNumber: number; voterName: string; submissionId: string; createdAt: string }>;
  leaderboard: Array<{ name: string; score: number }>;
};
type Cleanup = { id: string; roomCode: string; completedAt: string | null; participantCount: number; cleanedAt: string };

type PhaseFilter = 'all' | Room['phase'];

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to manage Meme Match.');
  return body;
}

export default function MemeMatchRoomsAdminPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [cleanup, setCleanup] = useState<Cleanup[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<PhaseFilter>('all');
  const [busy, setBusy] = useState(false);

  const loadRooms = async () => {
    try {
      const data = await request<{ rooms: Room[]; cleanup: Cleanup[] }>('/api/settings/meme-match/rooms');
      setRooms(data.rooms);
      setCleanup(data.cleanup);
      setSelectedCode((current) => current && data.rooms.some((room) => room.code === current) ? current : data.rooms[0]?.code ?? null);
    } catch (error) { toast({ variant: 'destructive', title: 'Could not load Meme Match rooms', description: error instanceof Error ? error.message : 'Please try again.' }); }
  };

  useEffect(() => { void loadRooms(); }, []);

  const visibleRooms = useMemo(() => filter === 'all' ? rooms : rooms.filter((room) => room.phase === filter), [filter, rooms]);
  const selectedRoom = rooms.find((room) => room.code === selectedCode) ?? null;

  const moderate = async (room: Room, payload: Record<string, string>, confirmation: string) => {
    if (!window.confirm(confirmation)) return;
    setBusy(true);
    try {
      const data = await request<{ room: Room }>(`/api/settings/meme-match/rooms/${room.code}`, { method: 'POST', body: JSON.stringify(payload) });
      setRooms((current) => current.map((item) => item.code === room.code ? data.room : item));
      toast({ title: 'Meme Match updated' });
    } catch (error) { toast({ variant: 'destructive', title: 'Moderation failed', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setBusy(false); }
  };

  const runCleanup = async () => {
    if (!window.confirm('Remove completed Meme Match games older than 30 days?')) return;
    setBusy(true);
    try { await request('/api/settings/meme-match/cleanup', { method: 'POST' }); await loadRooms(); toast({ title: 'Cleanup complete' }); }
    catch (error) { toast({ variant: 'destructive', title: 'Cleanup failed', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setBusy(false); }
  };

  const deleteRoom = async (room: Room) => {
    if (!window.confirm(`Delete Meme Match room ${room.code}? This removes its participants, submissions, and votes permanently.`)) return;
    setBusy(true);
    try { await request(`/api/settings/meme-match/rooms/${room.code}`, { method: 'DELETE' }); setRooms((current) => current.filter((item) => item.code !== room.code)); setSelectedCode(null); toast({ title: 'Meme Match room deleted' }); }
    catch (error) { toast({ variant: 'destructive', title: 'Room deletion failed', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setBusy(false); }
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Meme Match games</h1><p className="text-muted-foreground">Inspect running and completed games and correct problems without changing the player workflow.</p></div>
      <select value={filter} onChange={(event) => setFilter(event.target.value as PhaseFilter)} className="rounded-lg border bg-background px-3 py-2 text-sm">
        <option value="all">All phases</option><option value="lobby">Lobby</option><option value="submitting">Submitting</option><option value="voting">Voting</option><option value="reveal">Reveal</option><option value="complete">Complete</option>
      </select>
    </div>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card><CardHeader><CardTitle>Rooms</CardTitle><CardDescription>{visibleRooms.length} game{visibleRooms.length === 1 ? '' : 's'}</CardDescription></CardHeader><CardContent className="space-y-2">{visibleRooms.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No games match this filter.</p> : visibleRooms.map((room) => <button type="button" key={room.code} onClick={() => setSelectedCode(room.code)} className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left ${selectedCode === room.code ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}><span className="flex-1"><span className="font-mono font-bold tracking-widest">{room.code}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{room.phase} · round {room.currentRound}/{room.totalRounds} · {room.participantCount} players</span></span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>)}</CardContent></Card>
      {selectedRoom ? <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-mono tracking-widest">{selectedRoom.code}</CardTitle><CardDescription>Hosted by {selectedRoom.host.name} · {selectedRoom.host.email}</CardDescription></div><div className="flex items-center gap-2"><span className="rounded-full border px-3 py-1 text-xs capitalize">{selectedRoom.phase}</span><Button size="sm" variant="destructive" disabled={busy} onClick={() => void deleteRoom(selectedRoom)}>Delete room</Button></div></div></CardHeader><CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Round</p><p className="font-semibold">{selectedRoom.currentRound} / {selectedRoom.totalRounds}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Players</p><p className="font-semibold">{selectedRoom.participantCount}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Scores</p><p className="font-semibold">{selectedRoom.leaderboard.map((player) => `${player.name}: ${player.score}`).join(' · ') || '—'}</p></div></div>
        <div><h2 className="mb-2 font-semibold">Moderation</h2><div className="flex flex-wrap gap-2">{selectedRoom.phase !== 'complete' && <Button variant="outline" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'force-advance' }, `Force-advance room ${selectedRoom.code}?`)}>Force advance</Button>}{selectedRoom.currentRound > 0 && <Button variant="outline" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'reopen', phase: 'submitting' }, `Reopen round ${selectedRoom.currentRound} for submissions?`)}>Reopen submissions</Button>}<Button variant="outline" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'reopen', phase: 'voting' }, `Reopen voting for round ${selectedRoom.currentRound}?`)}>Reopen voting</Button><Button variant="outline" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'reopen', phase: 'reveal' }, `Reopen reveal for round ${selectedRoom.currentRound}?`)}>Reopen reveal</Button></div></div>
        <div><h2 className="mb-2 font-semibold">Participants</h2><div className="grid gap-2 sm:grid-cols-2">{selectedRoom.participants.map((participant) => <div key={participant.id} className="flex items-center justify-between rounded-lg border p-2 text-sm"><span>{participant.displayName}{participant.isHost ? ' · host' : ''}</span><span>{participant.score} pts</span></div>)}</div></div>
        <div><h2 className="mb-2 font-semibold">Submissions</h2><div className="space-y-2">{selectedRoom.submissions.length === 0 ? <p className="text-sm text-muted-foreground">No submissions.</p> : selectedRoom.submissions.map((submission) => <div key={submission.id} className="flex items-center gap-3 rounded-lg border p-3"><span className="min-w-0 flex-1"><span className="block truncate font-medium">Round {submission.roundNumber}: {submission.caption}</span><span className="text-xs text-muted-foreground">{submission.authorName} · {submission.voteCount} vote{submission.voteCount === 1 ? '' : 's'}</span></span><Button size="sm" variant="destructive" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'remove-submission', submissionId: submission.id }, `Remove this submission from room ${selectedRoom.code}?`)}>Remove</Button></div>)}</div></div>
        <div><h2 className="mb-2 font-semibold">Votes</h2><div className="space-y-2">{selectedRoom.votes.length === 0 ? <p className="text-sm text-muted-foreground">No votes.</p> : selectedRoom.votes.map((vote) => <div key={vote.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><span className="flex-1">Round {vote.roundNumber} · {vote.voterName}</span><Button size="sm" variant="destructive" disabled={busy} onClick={() => void moderate(selectedRoom, { action: 'remove-vote', voteId: vote.id }, `Remove this vote from room ${selectedRoom.code}?`)}>Remove</Button></div>)}</div></div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4" />Moderation actions are confirmed and recorded in the audit log.</p>
      </CardContent></Card> : <Card><CardContent className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Select a game to inspect it.</CardContent></Card>}
    </div>
    <Card><CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Recently cleaned up</CardTitle><CardDescription>Completed games removed after the 30-day retention period.</CardDescription></div><Button variant="outline" onClick={() => void runCleanup()} disabled={busy}>Run cleanup now</Button></CardHeader><CardContent>{cleanup.length === 0 ? <p className="text-sm text-muted-foreground">No games have been cleaned up yet.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{cleanup.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><p className="font-mono font-semibold tracking-widest">{item.roomCode}</p><p className="mt-1 text-muted-foreground">{item.participantCount} participants · cleaned {new Date(item.cleanedAt).toLocaleDateString('en-GB')}</p></div>)}</div>}</CardContent></Card>
  </div>;
}
