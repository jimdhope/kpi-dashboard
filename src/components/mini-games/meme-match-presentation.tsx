'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Users } from 'lucide-react';

type PresentationState = {
  room: { code: string; phase: 'lobby' | 'submitting' | 'voting' | 'reveal' | 'complete'; currentRound: number; totalRounds: number };
  prompt: { text: string; category: string | null } | null;
  participants: Array<{ name: string; isHost: boolean }>;
  submittedCount: number;
  voteCount: number;
  submissionCount: number;
  submissions: Array<{ id: string; gifUrl: string; previewUrl: string | null; caption: string; anonymousLabel: string; authorName?: string; voteCount: number }>;
  leaderboard: Array<{ name: string; score: number }>;
};

export function MemeMatchPresentation({ code, token }: { code: string; token: string }) {
  const [state, setState] = useState<PresentationState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/mini-games/meme-match/display?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'This presentation link is no longer valid.');
    setState(body);
    setError(null);
  }, [code, token]);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load presentation.'));
    const events = new EventSource(`/api/mini-games/meme-match/display/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
    const refresh = () => void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to refresh presentation.'));
    ['room-state', 'submission', 'vote', 'reveal', 'complete', 'room-deleted'].forEach((event) => events.addEventListener(event, refresh));
    events.onerror = () => undefined;
    return () => { events.close(); };
  }, [code, token, load]);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white"><div><h1 className="text-3xl font-bold">Presentation unavailable</h1><p className="mt-3 text-slate-300">{error}</p></div></main>;
  if (!state) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><p className="animate-pulse text-xl">Loading presentation…</p></main>;

  const { room, prompt, participants, submissions, leaderboard } = state;
  const isReveal = room.phase === 'reveal' || room.phase === 'complete';
  const phaseLabel = room.phase === 'lobby' ? 'Waiting for players' : room.phase === 'submitting' ? 'Create your meme' : room.phase === 'voting' ? 'Vote for the funniest' : room.phase === 'reveal' ? 'Round results' : 'Final results';

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-6"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-pink-300">Meme Match</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{phaseLabel}</h1></div><div className="rounded-2xl border border-pink-300/30 bg-pink-300/10 px-5 py-3 text-center"><p className="text-xs uppercase tracking-widest text-pink-200">Room code</p><p className="font-mono text-3xl font-black tracking-[0.25em]">{room.code}</p></div></div>
    {room.phase !== 'complete' && <div className="mx-auto mt-10 max-w-5xl text-center"><p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Round {room.currentRound} of {room.totalRounds}</p><h2 className="mt-3 text-4xl font-black sm:text-6xl">{prompt?.text || 'Waiting for the host to start…'}</h2>{prompt?.category && <p className="mt-4 text-lg text-slate-400">{prompt.category}</p>}</div>}
    {room.phase === 'lobby' && <section className="mx-auto mt-12 max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8"><div className="flex items-center justify-center gap-3 text-xl font-bold"><Users className="h-6 w-6 text-pink-300" />{participants.length} player{participants.length === 1 ? '' : 's'} joined</div><div className="mt-8 flex flex-wrap justify-center gap-3">{participants.map((participant, index) => <span className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-lg" key={`${participant.name}-${index}`}>{participant.name}{participant.isHost ? ' · host' : ''}</span>)}</div></section>}
    {room.phase === 'submitting' && <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-amber-300/30 bg-amber-300/10 p-10 text-center"><p className="text-7xl font-black text-amber-200">{state.submittedCount}<span className="text-4xl text-amber-200/60">/{participants.length}</span></p><p className="mt-4 text-2xl font-bold">memes submitted</p><p className="mt-2 text-slate-300">Waiting for the host to close submissions…</p></section>}
    {(room.phase === 'voting' || isReveal) && <section className="mx-auto mt-12 max-w-6xl"><div className="mb-6 flex items-center justify-between text-sm font-semibold uppercase tracking-widest text-slate-400"><span>{submissions.length} submissions</span><span>{state.voteCount} votes cast</span></div><div className="grid gap-6 md:grid-cols-2">{submissions.map((submission) => <article className="overflow-hidden rounded-3xl border border-white/15 bg-white/10" key={submission.id}><img src={submission.previewUrl || submission.gifUrl} alt="Meme submission" className="aspect-video w-full object-cover" /><div className="p-6"><p className="text-2xl font-bold">{submission.caption}</p><div className="mt-4 flex items-center justify-between text-slate-300"><span>{isReveal ? submission.authorName : submission.anonymousLabel}</span>{isReveal && <span className="font-semibold text-pink-200">{submission.voteCount} vote{submission.voteCount === 1 ? '' : 's'}</span>}</div></div></article>)}</div></section>}
    {room.phase === 'complete' && <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-amber-300/30 bg-amber-300/10 p-8"><div className="mb-6 flex items-center justify-center gap-3 text-2xl font-black"><Trophy className="h-8 w-8 text-amber-300" />Leaderboard</div><div className="space-y-3">{leaderboard.map((player, index) => <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4" key={`${player.name}-${index}`}><span className="w-10 text-2xl font-black text-amber-200">{index + 1}</span><span className="flex-1 text-xl font-bold">{player.name}</span><span className="text-xl font-bold">{player.score} pts</span></div>)}</div></section>}
  </main>;
}
