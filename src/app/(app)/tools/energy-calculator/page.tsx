import { EnergyCalculator } from '@/components/tools/energy-calculator';

export default function EnergyCalculatorPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Energy Calculator</h1>
        <p className="text-muted-foreground">
          Upload monthly meter exports or enter readings manually — one tool for electricity and gas usage, standing charges and costs.
        </p>
      </div>
      <EnergyCalculator />
    </div>
  );
}
