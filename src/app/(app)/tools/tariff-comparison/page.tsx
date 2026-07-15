import { TariffComparisonTool } from '@/components/tools/tariff-comparison-tool';

export default function TariffComparisonPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tariff Comparison Tool</h1>
        <p className="text-muted-foreground">Compare energy tariffs to find the best deal for customers.</p>
      </div>
      <TariffComparisonTool />
    </div>
  );
}
