'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Loader2, Copy, Check } from 'lucide-react';

interface Competition {
  id: string;
  name: string;
  startsAt: string | null;
  endsAt: string | null;
}

type PostType = 'basic' | 'byb' | 'league';

export default function PostGeneratorPage() {
  const { toast } = useToast();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [type, setType] = useState<PostType>('basic');
  const [thisWeekId, setThisWeekId] = useState('');
  const [nextWeekId, setNextWeekId] = useState('');
  const [theme, setTheme] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [vePost, setVePost] = useState('');
  const [teamsPost, setTeamsPost] = useState('');
  const [copiedVe, setCopiedVe] = useState(false);
  const [copiedTeams, setCopiedTeams] = useState(false);

  useEffect(() => {
    fetch('/api/competitions?includeDrafts=false')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setCompetitions(data.competitions || []))
      .catch(() => toast({ variant: 'destructive', title: 'Could not load competitions' }));
  }, [toast]);

  const generate = async () => {
    if (!thisWeekId) {
      toast({ variant: 'destructive', title: 'Please select this week\'s competition' });
      return;
    }
    if (!theme) {
      toast({ variant: 'destructive', title: 'Please enter a theme' });
      return;
    }
    setIsGenerating(true);
    setVePost('');
    setTeamsPost('');
    try {
      const response = await fetch('/api/competitions/post-generator/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          thisWeekCompetitionId: thisWeekId,
          nextWeekCompetitionId: nextWeekId || null,
          theme,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Generation failed');
      }
      const data = await response.json();
      setVePost(data.vivaEngagePost || '');
      setTeamsPost(data.teamsPost || '');
      toast({ title: 'Posts generated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: err.message || 'Could not generate posts' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copy = async (text: string, setter: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Megaphone className="h-8 w-8" />
          Post Generator
        </h1>
        <p className="text-muted-foreground">
          Generate celebratory weekly posts for Viva Engage and Microsoft Teams.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Select the competition and theme for this week&apos;s post.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {(['basic', 'byb', 'league'] as const).map((t) => (
              <Button
                key={t}
                variant={type === t ? 'default' : 'outline'}
                onClick={() => setType(t)}
              >
                {t === 'basic' ? 'Basic' : t === 'byb' ? 'Beat Your Best' : 'League'}
              </Button>
            ))}
          </div>

          {type === 'basic' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">This Week&apos;s Competition</label>
              <Select value={thisWeekId} onValueChange={setThisWeekId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a competition" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Next Week&apos;s Competition (optional)</label>
            <Select value={nextWeekId} onValueChange={setNextWeekId}>
              <SelectTrigger>
                <SelectValue placeholder="Select next week's competition" />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Next Week&apos;s Theme</label>
            <Input
              placeholder="e.g. Space Week, Heroes, Under the Sea"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>

          <Button onClick={generate} disabled={isGenerating}>
            {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Posts'}
          </Button>
        </CardContent>
      </Card>

      {vePost && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Viva Engage Post
              <Button variant="ghost" size="sm" onClick={() => copy(vePost, setCopiedVe)}>
                {copiedVe ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded">{vePost}</pre>
          </CardContent>
        </Card>
      )}

      {teamsPost && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Teams Post
              <Button variant="ghost" size="sm" onClick={() => copy(teamsPost, setCopiedTeams)}>
                {copiedTeams ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded">{teamsPost}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
