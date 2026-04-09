'use client';

import { AgreedReadsCalculator } from '@/components/tools/agreed-reads-calculator';

export default function AgreedReadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agreed Reads Calculator</h1>
        <p className="text-muted-foreground">Calculate agreed meter reads for billing periods with proposed dates.</p>
      </div>
      <AgreedReadsCalculator />
    </div>
  );
}
