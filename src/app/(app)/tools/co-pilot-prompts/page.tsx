import { CopilotPromptPhrases } from '@/components/tools/copilot-prompt-phrases';

export default function CopilotPromptPhrasesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Co-Pilot Prompt Phrases</h1>
        <p className="text-muted-foreground">
          Every prompt the call copilot listens for, with the phrases that complete it — say them in
          your own words, naturally, on the call.
        </p>
      </div>
      <CopilotPromptPhrases />
    </div>
  );
}
