'use client';

import { InstalmentPlanCalculator } from '@/components/tools/instalment-plan-calculator';

export default function InstalmentPlanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Instalment Plan Calculator</h1>
        <p className="text-muted-foreground">Calculate payment plans and suggested instalment amounts for customer balances.</p>
      </div>
      <InstalmentPlanCalculator />
    </div>
  );
}
