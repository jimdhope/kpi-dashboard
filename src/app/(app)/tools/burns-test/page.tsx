import { BurnsTestCalculator } from '@/components/tools/burns-test-calculator';

export default function BurnsTestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Burns Test Calculator</h1>
        <p className="text-muted-foreground">Track 7-day meter readings to identify potential energy usage issues.</p>
      </div>
      <BurnsTestCalculator />
    </div>
  );
}
