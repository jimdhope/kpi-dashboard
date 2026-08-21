'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, MonitorPlay, Play, Search, Sparkles, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type GifResult = { id: string; url: string; previewUrl: string; title: string };
type Room = {
  code: string;
  phase: 'lobby' | 'submitting' | 'voting' | 'reveal' | 'complete';
  roundNumber: number;
  prompt?: { text: string };
  isHost: boolean;
  currentUserId: string;
  participants: Array<{ id: string; name: string; score: number }>;
  mySubmission?: { gifUrl: string; gifPreviewUrl?: string; caption: string } | null;
  submissions?: Array<{ id: string; gifUrl: string; gifPreviewUrl?: string; caption: string; authorName?: string; votes: number; hasVoted?: boolean }>;
  results?: Array<{ name: string; score: number }>;
  votesCast: number;
};
type ActiveRoom = { code: string; phase: Room['phase']; currentRound: number; participantCount: number };

function normalizeRoom(data: any): Room {
  const state = data.room && data.viewer ? data : { room: data };
  const raw = state.room;
  return {
    code: raw.code,
    phase: raw.phase,
    roundNumber: raw.currentRound || 0,
    prompt: state.prompt || undefined,
    isHost: Boolean(state.viewer?.isHost),
    currentUserId: state.viewer?.userId || '',
    participants: (state.participants || []).map((item: any) => ({ id: item.userId || item.id, name: item.displayName || item.name, score: item.score || 0 })),
    submissions: (state.submissions || []).map((item: any) => ({
      id: item.id || item.submissionId,
      gifUrl: item.gifUrl,
      gifPreviewUrl: item.previewUrl,
      caption: item.caption,
      authorName: item.authorName,
      votes: item.voteCount || 0,
      hasVoted: (state.votesCastByViewer || []).includes(item.id || item.submissionId),
    })),
    results: (state.leaderboard || []).map((item: any) => ({ name: item.name, score: item.score || 0 })),
    votesCast: state.votesCast || 0,
  };
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || 'Unable to update Meme Match.'); (error as Error & { status?: number }).status = response.status; throw error; }
  return body;
}

export default function MemeMatchPage() {
  const { toast } = useToast();
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [selectedGif, setSelectedGif] = useState<GifResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);

  const loadRoom = useCallback(async (code: string) => {
    const data = await jsonRequest(`/api/mini-games/meme-match/rooms/${encodeURIComponent(code)}`);
    setRoom(normalizeRoom(data));
    sessionStorage.setItem('meme-match-room-code', code.toUpperCase());
  }, []);

  useEffect(() => {
    const savedCode = sessionStorage.getItem('meme-match-room-code');
    if (!savedCode) return;
    void loadRoom(savedCode).catch((error) => {
      const status = (error as Error & { status?: number }).status;
      if (status === 403 || status === 404) sessionStorage.removeItem('meme-match-room-code');
    });
  }, [loadRoom]);

  useEffect(() => {
    void jsonRequest('/api/mini-games/meme-match/rooms/active').then(data => setActiveRooms(data.rooms || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!room?.code) return;
    const events = new EventSource(`/api/mini-games/meme-match/rooms/${encodeURIComponent(room.code)}/events`);
    const refreshRoom = () => void loadRoom(room.code).catch(() => undefined);
    events.addEventListener('room-state', refreshRoom);
    events.addEventListener('submission', refreshRoom);
    events.addEventListener('vote', refreshRoom);
    events.onerror = () => events.close();
    return () => {
      events.removeEventListener('room-state', refreshRoom);
      events.removeEventListener('submission', refreshRoom);
      events.removeEventListener('vote', refreshRoom);
      events.close();
    };
  }, [loadRoom, room?.code]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!room) return;
    setBusy(true);
    try {
      const data = await jsonRequest(`/api/mini-games/meme-match/rooms/${encodeURIComponent(room.code)}`, { method: 'POST', body: JSON.stringify({ action, ...extra }) });
      setRoom(normalizeRoom(data));
      if (action === 'submit') { setCaption(''); setSelectedGif(null); }
    } catch (error) { toast({ variant: 'destructive', title: 'Meme Match', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setBusy(false); }
  };

  const createRoom = async () => {
    setBusy(true);
    try { const data = await jsonRequest('/api/mini-games/meme-match/rooms', { method: 'POST', body: JSON.stringify({}) }); await loadRoom(data.room.code); }
    catch (error) { toast({ variant: 'destructive', title: 'Could not create room', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setBusy(false); }
  };

  const joinRoom = async () => {
    setBusy(true);
    try { const data = await jsonRequest('/api/mini-games/meme-match/rooms/join', { method: 'POST', body: JSON.stringify({ code: joinCode.trim().toUpperCase() }) }); await loadRoom(data.room.code); }
    catch (error) { toast({ variant: 'destructive', title: 'Could not join room', description: error instanceof Error ? error.message : 'Check the room code.' }); }
    finally { setBusy(false); }
  };

  const searchGifs = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try { const data = await jsonRequest(`/api/mini-games/meme-match/search?q=${encodeURIComponent(query.trim())}`); setGifs(data.results || data.gifs || []); }
    catch (error) { toast({ variant: 'destructive', title: 'GIF search unavailable', description: error instanceof Error ? error.message : 'Please try again.' }); }
    finally { setSearching(false); }
  };

  const exitGame = () => {
    sessionStorage.removeItem('meme-match-room-code');
    setRoom(null);
    setJoinCode('');
    setCaption('');
    setQuery('');
    setGifs([]);
    setSelectedGif(null);
  };

  const openPresentation = async () => {
    const displayWindow = window.open('about:blank', '_blank');
    if (!displayWindow) {
      toast({ variant: 'destructive', title: 'Presentation view blocked', description: 'Allow pop-ups for this site and try again.' });
      return;
    }
    try {
      const data = await jsonRequest(`/api/mini-games/meme-match/rooms/${encodeURIComponent(room?.code || '')}/display-link`);
      displayWindow.location.href = data.url;
    } catch (error) {
      displayWindow.close();
      toast({ variant: 'destructive', title: 'Could not open presentation view', description: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  const hasSubmitted = Boolean(room?.mySubmission);
  const submittedCount = room?.submissions?.length ?? 0;
  const canVote = room?.phase === 'voting';
  const sortedParticipants = useMemo(() => [...(room?.participants || [])].sort((a, b) => b.score - a.score), [room?.participants]);

  if (!room) return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-3xl font-bold">Meme Match</h1><p className="text-muted-foreground">Build the funniest GIF and caption combo across three rounds.</p></div>
    <div className="grid gap-6 md:grid-cols-2">
      <Card variant="glass"><CardHeader><CardTitle>Host a game</CardTitle><CardDescription>Create a room and share its code with your Friday meeting.</CardDescription></CardHeader><CardContent><Button size="lg" onClick={createRoom} disabled={busy}><Play className="mr-2 h-4 w-4" />Create room</Button></CardContent></Card>
      <Card variant="glass"><CardHeader><CardTitle>Join a game</CardTitle><CardDescription>Enter the four-to-six character code from your host.</CardDescription></CardHeader><CardContent className="flex gap-2"><Input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ROOM CODE" onKeyDown={e => e.key === 'Enter' && void joinRoom()} /><Button onClick={joinRoom} disabled={busy || !joinCode.trim()}>Join</Button></CardContent></Card>
    </div>
    {activeRooms.length > 0 && <Card variant="glass"><CardHeader><CardTitle>Running games</CardTitle><CardDescription>Admin view of active Meme Match rooms.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{activeRooms.map(activeRoom => <div key={activeRoom.code} className="rounded-lg border p-4"><div className="flex items-center justify-between"><span className="font-mono font-bold tracking-widest">{activeRoom.code}</span><span className="text-sm capitalize text-muted-foreground">{activeRoom.phase}</span></div><p className="mt-2 text-sm text-muted-foreground">Round {activeRoom.currentRound} of 3 · {activeRoom.participantCount} participants</p><Button className="mt-3 w-full" variant="outline" onClick={() => { void navigator.clipboard?.writeText(activeRoom.code); toast({ title: 'Room code copied' }); }}>Copy room code</Button></div>)}</CardContent></Card>}
  </div>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold">Meme Match</h1><p className="text-muted-foreground">Room <span className="font-mono font-bold tracking-widest text-foreground">{room.code}</span> · Round {room.roundNumber} of 3</p></div><div className="flex items-center gap-3"><div className="rounded-lg border bg-muted/30 px-4 py-2 text-center"><p className="text-xs uppercase tracking-wider text-muted-foreground">Phase</p><p className="font-semibold capitalize">{room.phase}</p></div>{room.isHost && <Button variant="outline" onClick={() => void openPresentation()}><MonitorPlay className="mr-2 h-4 w-4" />Open presentation view</Button>}</div></div>
    {room.phase === 'lobby' && <Card variant="glass"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Waiting room</CardTitle><CardDescription>Share the code, then start when everyone is ready.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="flex flex-wrap gap-2">{room.participants.map(player => <span key={player.id} className="rounded-full border px-3 py-1 text-sm">{player.name}{player.id === room.currentUserId ? ' (you)' : ''}</span>)}</div>{room.isHost ? <Button onClick={() => void act('start')} disabled={busy || room.participants.length < 4}>Start round one</Button> : <p className="text-sm text-muted-foreground">Waiting for the host to start…</p>}</CardContent></Card>}
    {room.prompt && room.phase !== 'complete' && <Card variant="glass"><CardHeader><CardDescription>Round {room.roundNumber} prompt</CardDescription><CardTitle className="text-2xl">{room.prompt.text}</CardTitle></CardHeader>{room.phase === 'submitting' && <CardContent className="space-y-5">{hasSubmitted ? <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4"><p className="font-semibold">Your meme is submitted.</p><p className="text-sm text-muted-foreground">You can update it until the host closes submissions.</p></div> : null}<div className="flex gap-2"><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search GIPHY…" onKeyDown={e => e.key === 'Enter' && void searchGifs()} /><Button onClick={searchGifs} disabled={searching || !query.trim()}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{gifs.map(gif => <button type="button" key={gif.id} onClick={() => setSelectedGif(gif)} className={`overflow-hidden rounded-lg border-2 text-left ${selectedGif?.id === gif.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}><img src={gif.previewUrl || gif.url} alt={gif.title} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-xs">{gif.title || 'GIF'}</span></button>)}</div>{selectedGif && <div className="space-y-3"><img src={selectedGif.url} alt="Selected GIF" className="max-h-72 rounded-lg object-contain" /><Textarea value={caption} onChange={e => setCaption(e.target.value)} maxLength={180} placeholder="Write the caption that makes this GIF hilarious…" /><Button onClick={() => void act('submit', { gifId: selectedGif.id, gifUrl: selectedGif.url, previewUrl: selectedGif.previewUrl, gifTitle: selectedGif.title, caption: caption.trim() })} disabled={busy || !caption.trim()}><Sparkles className="mr-2 h-4 w-4" />Submit meme</Button></div>}{room.isHost && <div className="flex flex-wrap items-center justify-between gap-3"><div aria-live="polite" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{submittedCount} of {room.participants.length}</span> players submitted</div><Button variant="outline" onClick={() => void act('advance')} disabled={busy}>Close submissions</Button></div>}</CardContent>}</Card>}
    {canVote && <Card variant="glass"><CardHeader><CardTitle>Vote for the funniest</CardTitle><CardDescription>Submissions are anonymous. Choose one meme; you cannot vote for your own.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 md:grid-cols-2">{(room.submissions || []).map(submission => <div key={submission.id} className="rounded-xl border p-3"><img src={submission.gifPreviewUrl || submission.gifUrl} alt="Meme submission" className="aspect-video w-full rounded-lg object-cover" /><p className="mt-3 text-lg font-semibold">{submission.caption}</p><Button className="mt-3 w-full" variant={submission.hasVoted ? 'secondary' : 'default'} disabled={busy || Boolean(submission.hasVoted)} onClick={() => void act('vote', { submissionId: submission.id })}>{submission.hasVoted ? 'Vote recorded' : 'Vote for this'}</Button></div>)}</div>{room.isHost && <div className="flex flex-wrap items-center justify-between gap-3"><div aria-live="polite" className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{room.votesCast} of {room.participants.length}</span> players voted</div><Button variant="outline" onClick={() => void act('advance')} disabled={busy}>Close voting and reveal</Button></div>}</CardContent></Card>}
    {room.phase === 'reveal' && <Card variant="glass"><CardHeader><CardTitle>Round {room.roundNumber} results</CardTitle><CardDescription>Here are the memes that won the room’s votes.</CardDescription></CardHeader><CardContent className="space-y-4">{(room.submissions || []).sort((a, b) => b.votes - a.votes).map(submission => <div key={submission.id} className="flex gap-4 rounded-lg border p-3"><img src={submission.gifPreviewUrl || submission.gifUrl} alt="Meme submission" className="h-24 w-32 rounded object-cover" /><div className="min-w-0 flex-1"><p className="font-semibold">{submission.caption}</p><p className="text-sm text-muted-foreground">{submission.authorName || 'Player'} · {submission.votes} vote{submission.votes === 1 ? '' : 's'}</p></div></div>)}{room.isHost && <Button onClick={() => void act('advance')} disabled={busy}>{room.roundNumber === 3 ? 'Show final results' : 'Start next round'}</Button>}</CardContent></Card>}
    {room.phase === 'complete' && <Card variant="glass"><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Final leaderboard</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-2">{(room.results || sortedParticipants).map((player, index) => <div key={`${player.name}-${index}`} className="flex items-center gap-3 rounded-lg border px-4 py-3"><span className="w-8 text-xl font-bold">{index + 1}</span><span className="flex-1 font-semibold">{player.name}</span><span>{player.score} point{player.score === 1 ? '' : 's'}</span></div>)}</div><Button variant="outline" onClick={exitGame}><LogOut className="mr-2 h-4 w-4" />Exit game</Button></CardContent></Card>}
    {room.isHost && room.phase !== 'lobby' && room.phase !== 'complete' && <p className="text-right text-sm text-muted-foreground">As host, advance the room when the meeting is ready.</p>}
  </div>;
}
