'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Trophy, Users } from 'lucide-react';

type PresentationState = {
  room: { code: string; phase: 'lobby' | 'answering' | 'reveal' | 'complete'; currentQuestion: number; totalQuestions: number; questionStartedAt: string | null; answerDeadlineAt: string | null; quiz: { title: string } };
  participants: Array<{ name: string; isHost: boolean }>;
  question: { position: number; text: string; type: string; mediaUrl: string | null; mediaContentType: string | null; options: Array<{ id: string; text: string; position: number; isCorrect?: boolean }> } | null;
  results: { responseCount: number; distribution: Array<{ optionId: string; count: number }> } | null;
  leaderboard: Array<{ name: string; score: number }>;
};

export function QuizShowPresentation({ code, token }: { code: string; token: string }) {
  const [state, setState] = useState<PresentationState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/mini-games/quiz-show/display?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'This presentation link is no longer valid.');
    setState(body);
    setError(null);
  }, [code, token]);

  useEffect(() => {
    void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load presentation.'));
    const events = new EventSource(`/api/mini-games/quiz-show/display/events?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`);
    const refresh = () => void load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to refresh presentation.'));
    ['room-state', 'question-started', 'answer', 'reveal', 'complete'].forEach((event) => events.addEventListener(event, refresh));
    events.onerror = () => undefined;
    return () => { events.close(); };
  }, [code, token, load]);

  useEffect(() => {
    if (!state?.room.answerDeadlineAt || state.room.phase !== 'answering') { setSecondsLeft(null); return; }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(state.room.answerDeadlineAt as string).getTime() - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [state?.room.answerDeadlineAt, state?.room.phase]);

  if (error) return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white"><div><h1 className="text-3xl font-bold">Presentation unavailable</h1><p className="mt-3 text-slate-300">{error}</p></div></main>;
  if (!state) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><p className="animate-pulse text-xl">Loading presentation…</p></main>;

  const { room, question, participants, results, leaderboard } = state;
  const isReveal = room.phase === 'reveal' || room.phase === 'complete';
  const phaseLabel = room.phase === 'lobby' ? 'Waiting for players' : room.phase === 'answering' ? 'Choose your answer' : room.phase === 'reveal' ? 'Answer revealed' : 'Final results';
  const distribution = new Map((results?.distribution || []).map((item) => [item.optionId, item.count]));
  const isVideo = question?.mediaContentType?.startsWith('video/');

  return <main className="min-h-screen bg-slate-950 px-6 py-8 text-white sm:px-10 lg:px-16">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-6"><div><p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Quiz Show · {room.quiz.title}</p><h1 className="mt-2 text-3xl font-black sm:text-5xl">{phaseLabel}</h1></div><div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-center"><p className="text-xs uppercase tracking-widest text-cyan-200">Room code</p><p className="font-mono text-3xl font-black tracking-[0.25em]">{room.code}</p></div></div>
    {room.phase === 'lobby' && <section className="mx-auto mt-12 max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8"><div className="flex items-center justify-center gap-3 text-xl font-bold"><Users className="h-6 w-6 text-cyan-300" />{participants.length} player{participants.length === 1 ? '' : 's'} joined</div><div className="mt-8 flex flex-wrap justify-center gap-3">{participants.map((participant, index) => <span className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-lg" key={`${participant.name}-${index}`}>{participant.name}{participant.isHost ? ' · host' : ''}</span>)}</div></section>}
    {question && room.phase !== 'complete' && <section className="mx-auto mt-10 max-w-6xl"><div className="mb-5 flex items-center justify-between text-sm font-semibold uppercase tracking-widest text-slate-400"><span>Question {room.currentQuestion + 1} of {room.totalQuestions}</span>{room.phase === 'answering' && <span className="flex items-center gap-2 text-amber-200"><Clock className="h-5 w-5" />{secondsLeft ?? '—'}s</span>}{room.phase === 'reveal' && <span>{results?.responseCount || 0} answers received</span>}</div><div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-10"><h2 className="text-center text-3xl font-black sm:text-5xl">{question.text}</h2>{question.mediaUrl && (isVideo ? <video controls className="mx-auto mt-8 max-h-80 w-full rounded-2xl" src={question.mediaUrl} /> : <img className="mx-auto mt-8 max-h-80 rounded-2xl object-contain" src={question.mediaUrl} alt="Question media" />)}<div className="mt-10 grid gap-4 sm:grid-cols-2">{question.options.map((option, index) => <div className={`rounded-2xl border p-5 text-xl font-bold ${option.isCorrect ? 'border-green-300 bg-green-300/15 text-green-100' : 'border-white/15 bg-slate-950/30'}`} key={option.id}><span className="mr-3 text-cyan-200">{String.fromCharCode(65 + index)}.</span>{option.text}{isReveal && <span className="float-right ml-3 text-base font-semibold text-slate-300">{distribution.get(option.id) || 0} answer{distribution.get(option.id) === 1 ? '' : 's'}</span>}</div>)}</div>{room.phase === 'answering' && <p className="mt-8 text-center text-lg text-slate-300">Answers are being collected…</p>}{room.phase === 'reveal' && <p className="mt-8 text-center text-lg font-semibold text-green-200">Correct answers are highlighted</p>}</div></section>}
    {room.phase === 'complete' && <section className="mx-auto mt-12 max-w-3xl rounded-3xl border border-amber-300/30 bg-amber-300/10 p-8"><div className="mb-6 flex items-center justify-center gap-3 text-2xl font-black"><Trophy className="h-8 w-8 text-amber-300" />Final leaderboard</div><div className="space-y-3">{leaderboard.map((player, index) => <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/40 px-5 py-4" key={`${player.name}-${index}`}><span className="w-10 text-2xl font-black text-amber-200">{index + 1}</span><span className="flex-1 text-xl font-bold">{player.name}</span><span className="text-xl font-bold">{player.score} pts</span></div>)}</div></section>}
  </main>;
}
