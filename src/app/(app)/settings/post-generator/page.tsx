'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export interface PostGeneratorSection {
  name: string;
  wordCount: number;
  content: string;
  enabled: boolean;
}

export interface PostGeneratorTemplate {
  sections: PostGeneratorSection[];
}

export interface PostGeneratorSettings {
  apiKey: string | null;
  veTemplate: PostGeneratorTemplate;
  teamsTemplate: PostGeneratorTemplate;
}

const DEFAULT_SECTIONS: PostGeneratorSection[] = [
  { name: 'Introduction', wordCount: 80, content: '', enabled: true },
  { name: 'Scores & Winners', wordCount: 100, content: '', enabled: true },
  { name: 'New Theme & Teams', wordCount: 80, content: '', enabled: true },
  { name: 'Pep Talk & Teamwork', wordCount: 80, content: '', enabled: true },
  { name: 'Conclusion', wordCount: 40, content: '', enabled: true },
];

export default function PostGeneratorSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PostGeneratorSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/competitions/post-generator/settings')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('Failed to load'))))
      .then((data: PostGeneratorSettings) => {
        setSettings(data);
        setApiKey(data.apiKey || '');
      })
      .catch(() => toast({ variant: 'destructive', title: 'Could not load settings' }));
  }, [toast]);

  const saveApiKey = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/competitions/post-generator/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'apiKey', apiKey }),
      });
      if (!response.ok) throw new Error('Failed to save');
      toast({ title: 'API key saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save API key' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSection = (type: 've' | 'teams', index: number, patch: Partial<PostGeneratorSection>) => {
    if (!settings) return;
    const template = type === 've' ? settings.veTemplate : settings.teamsTemplate;
    const sections = template.sections.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setSettings({
      ...settings,
      [type === 've' ? 'veTemplate' : 'teamsTemplate']: { sections },
    });
  };

  const saveTemplates = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await Promise.all([
        fetch('/api/competitions/post-generator/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'template', template: 've', sections: settings.veTemplate.sections }),
        }),
        fetch('/api/competitions/post-generator/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'template', template: 'teams', sections: settings.teamsTemplate.sections }),
        }),
      ]);
      toast({ title: 'Templates saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not save templates' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Post Generator</h1>
        <p className="text-muted-foreground">
          Generate celebratory weekly posts for Viva Engage and Microsoft Teams using AI.
        </p>
      </div>

      {!settings ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>OpenRouter API Key</CardTitle>
              <CardDescription>
                Enter your OpenRouter API key. The free tier routes to available models automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="sk-or-v1-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Button onClick={saveApiKey} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Key'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Templates</CardTitle>
              <CardDescription>
                Edit the post templates for each platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['ve', 'teams'] as const).map((type) => {
                const template = type === 've' ? settings.veTemplate : settings.teamsTemplate;
                const label = type === 've' ? 'Viva Engage' : 'Teams';
                return (
                  <div key={type} className="space-y-4">
                    <h3 className="text-lg font-semibold">{label} Template</h3>
                    {template.sections.map((section, index) => (
                      <div key={section.name} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{section.name}</span>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={section.enabled}
                              onChange={(e) => updateSection(type, index, { enabled: e.target.checked })}
                            />
                            Enabled
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-muted-foreground">Word count:</label>
                          <Input
                            type="number"
                            min={0}
                            max={500}
                            value={section.wordCount}
                            onChange={(e) => updateSection(type, index, { wordCount: parseInt(e.target.value) || 0 })}
                            className="w-24"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              <Button onClick={saveTemplates} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Templates'}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
