'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

type Prompt = { id: string; text: string; category?: string | null; isActive: boolean };

export default function MemeMatchSettingsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Prompt[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => fetch('/api/settings/meme-match/prompts').then(response => response.json()).then(data => setItems(data.prompts || []));
  useEffect(() => { void load(); }, []);
  const save = async () => {
    const response = await fetch(editing ? `/api/settings/meme-match/prompts/${editing}` : '/api/settings/meme-match/prompts', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, category: category || null }) });
    if (!response.ok) { toast({ variant: 'destructive', title: 'Could not save prompt' }); return; }
    setText(''); setCategory(''); setEditing(null); await load();
  };
  const toggle = async (item: Prompt) => { await fetch(`/api/settings/meme-match/prompts/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: item.text, category: item.category || null, isActive: !item.isActive }) }); await load(); };
  const remove = async (id: string) => { if (!confirm('Delete this prompt?')) return; await fetch(`/api/settings/meme-match/prompts/${id}`, { method: 'DELETE' }); await load(); };
  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-3xl font-bold">Meme Match Prompts</h1><p className="text-muted-foreground">Maintain the prompt bank used by Friday meeting games.</p></div>
    <Card><CardHeader><CardTitle>{editing ? 'Edit prompt' : 'Add prompt'}</CardTitle><CardDescription>Prompts should invite a funny situation without requiring specialist knowledge.</CardDescription></CardHeader><CardContent className="space-y-3"><Input value={text} onChange={event => setText(event.target.value)} maxLength={240} placeholder="When the meeting could have been an email…" /><Input value={category} onChange={event => setCategory(event.target.value)} maxLength={60} placeholder="Category (optional)" /><div className="flex gap-2"><Button onClick={() => void save()} disabled={!text.trim()}>{editing ? 'Save changes' : 'Add prompt'}</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setText(''); setCategory(''); }}>Cancel</Button>}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Prompt bank</CardTitle></CardHeader><CardContent className="space-y-2">{items.length === 0 ? <p className="py-6 text-center text-muted-foreground">No prompts yet.</p> : items.map(item => <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p>{item.text}</p><p className="text-xs text-muted-foreground">{item.category || 'Uncategorised'} · {item.isActive ? 'Active' : 'Inactive'}</p></div><Button size="sm" variant="outline" onClick={() => void toggle(item)}>{item.isActive ? 'Deactivate' : 'Activate'}</Button><Button size="sm" variant="outline" onClick={() => { setEditing(item.id); setText(item.text); setCategory(item.category || ''); }}>Edit</Button><Button size="sm" variant="destructive" onClick={() => void remove(item.id)}>Delete</Button></div>)}</CardContent></Card>
  </div>;
}
