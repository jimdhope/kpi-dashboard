'use client';

import { DualFuelCalculator } from '@/components/tools/dual-fuel-calculator';

export default function DualFuelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dual Fuel Calculator</h1>
        <p className="text-muted-foreground">Calculate monthly payments for dual fuel accounts with balances.</p>
      </div>
      <DualFuelCalculator />
    </div>
  );
}
