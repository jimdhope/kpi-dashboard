'use client';

import { EnergyUsageCalculator } from '@/components/tools/energy-usage-calculator';

export default function EnergyUsagePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Energy Usage Calculator</h1>
        <p className="text-muted-foreground">Calculate energy usage and costs from meter readings or direct input.</p>
      </div>
      <EnergyUsageCalculator />
    </div>
  );
}
