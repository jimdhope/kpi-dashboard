"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  COPILOT_ACTION_PROMPTS,
  COPILOT_PHRASE_PROMPTS,
  type CopilotPhrasePrompt,
} from "@/lib/copilot-prompts";

export function CopilotPromptPhrases() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return COPILOT_PHRASE_PROMPTS;
    return COPILOT_PHRASE_PROMPTS.filter((prompt) => {
      if (prompt.title.toLowerCase().includes(needle)) return true;
      if (prompt.keyWords.some((keyword) => keyword.toLowerCase().includes(needle))) return true;
      return prompt.phrases.some((phrase) => phrase.toLowerCase().includes(needle));
    });
  }, [query]);

  function toggle(id: string) {
    setOpenId((current) => (current === id ? null : id));
  }

  return (
    <div className="space-y-6">
      <Card className="w-full shadow-lg">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <span className="rounded-lg bg-primary/15 p-1.5 text-primary">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </span>
            Co-Pilot Prompt Phrases
          </CardTitle>
          <CardDescription className="max-w-2xl">
            The call copilot listens to the live transcript and raises an alert when a prompt has not
            been completed. Open a prompt to see phrases that complete it — say them in your own
            words, naturally, on the call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a prompt, key word or phrase…"
              className="pl-9"
              aria-label="Search prompts"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="phrases">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phrases">
            <MessageSquareText className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Phrase prompts ({COPILOT_PHRASE_PROMPTS.length})
          </TabsTrigger>
          <TabsTrigger value="actions">
            <ListChecks className="mr-1.5 h-4 w-4" aria-hidden="true" />
            System actions ({COPILOT_ACTION_PROMPTS.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phrases" className="space-y-2 pt-2">
          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No prompts match “{query}”.
              </CardContent>
            </Card>
          )}
          {filtered.map((prompt) => (
            <PromptRow
              key={prompt.id}
              prompt={prompt}
              open={openId === prompt.id}
              onToggle={() => toggle(prompt.id)}
            />
          ))}
        </TabsContent>

        <TabsContent value="actions" className="space-y-2 pt-2">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">Prompts that need a system action</CardTitle>
              <CardDescription>
                These prompts are not completed by a phrase — the copilot is checking that the action
                was taken on the system during the call.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {COPILOT_ACTION_PROMPTS.map((action) => {
                const open = openId === `action-${action.id}`;
                return (
                  <div
                    key={action.id}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(`action-${action.id}`)}
                      aria-expanded={open}
                      aria-controls={`action-${action.id}-panel`}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="text-sm font-semibold">{action.title}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    {open && (
                      <div
                        id={`action-${action.id}-panel`}
                        className="border-t border-border px-3 py-2.5 text-sm text-muted-foreground"
                      >
                        {action.detail}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface PromptRowProps {
  prompt: CopilotPhrasePrompt;
  open: boolean;
  onToggle: () => void;
}

function PromptRow({ prompt, open, onToggle }: PromptRowProps) {
  const panelId = `${prompt.id}-panel`;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-sm font-semibold">{prompt.title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div id={panelId} className="space-y-3 border-t border-border px-3 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Key words
            </span>
            {prompt.keyWords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="font-normal">
                {keyword}
              </Badge>
            ))}
          </div>
          <Separator />
          <ul className="space-y-2">
            {prompt.phrases.map((phrase) => (
              <li key={phrase} className="text-sm leading-relaxed">
                “{phrase}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
