'use client';

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Room = { room: { code: string; phase: string; currentQuestion: number; totalQuestions: number; startedAt?: string | null; completedAt?: string | null; host: { name: string; email: string }; quiz: { title: string } }; participants: Array<{ id: string; name: string; score: number }>; leaderboard: Array<{ name: string; score: number }> };

export default function QuizShowRoomsPage() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busy, setBusy] = useState(false);
  const load = async () => { const response = await fetch("/api/settings/quiz-show/rooms"); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to load Quiz Show rooms."); setRooms(body.rooms || []); };
  useEffect(() => { void load().catch((error) => toast({ variant: "destructive", title: "Could not load Quiz Show rooms", description: error instanceof Error ? error.message : "Please try again." })); }, []);
  const remove = async (room: Room) => { if (!confirm(`Delete Quiz Show room ${room.room.code}? This permanently removes its answers and participants.`)) return; setBusy(true); try { const response = await fetch(`/api/settings/quiz-show/rooms/${room.room.code}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to delete room."); setRooms((current) => current.filter((item) => item.room.code !== room.room.code)); toast({ title: "Quiz Show room deleted" }); } catch (error) { toast({ variant: "destructive", title: "Room deletion failed", description: error instanceof Error ? error.message : "Please try again." }); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-6xl space-y-6"><div><h1 className="text-3xl font-bold">Quiz Show rooms</h1><p className="text-muted-foreground">All retained Quiz Show rooms, including active and completed games.</p></div><Card><CardHeader><CardTitle>Rooms</CardTitle><CardDescription>{rooms.length} room{rooms.length === 1 ? "" : "s"}</CardDescription></CardHeader><CardContent className="space-y-3">{rooms.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No Quiz Show rooms have been created.</p> : rooms.map((room) => <div className="flex flex-wrap items-center gap-4 rounded-lg border p-4" key={room.room.code}><div className="min-w-0 flex-1"><p className="font-mono font-bold tracking-widest">{room.room.code}</p><p className="text-sm font-medium">{room.room.quiz.title}</p><p className="text-xs capitalize text-muted-foreground">{room.room.phase} · question {Math.max(0, room.room.currentQuestion + 1)} of {room.room.totalQuestions} · {room.participants.length} players · host {room.room.host.name}</p></div><div className="text-right text-sm"><p className="font-semibold">{room.leaderboard[0]?.score ?? 0} top points</p><p className="text-xs text-muted-foreground">{room.room.completedAt ? `Completed ${new Date(room.room.completedAt).toLocaleDateString("en-GB")}` : "In progress"}</p></div><Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(room)}>Delete room</Button></div>)}</CardContent></Card></div>;
}
