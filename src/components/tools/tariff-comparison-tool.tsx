'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Trash2 } from 'lucide-react';

interface TariffData {
  id: string;
  name: string;
  elecStandingCharge: string;
  elecRate1: string;
  elecRate2: string;
  elecRate3: string;
  gasStandingCharge: string;
  gasRate: string;
}

export function TariffComparisonTool() {
  const [elecUsage1, setElecUsage1] = useState('');
  const [elecUsage2, setElecUsage2] = useState('');
  const [elecUsage3, setElecUsage3] = useState('');
  const [gasUsage, setGasUsage] = useState('');

  const [tariffs, setTariffs] = useState<TariffData[]>([
    { id: '1', name: 'Tariff 1', elecStandingCharge: '', elecRate1: '', elecRate2: '', elecRate3: '', gasStandingCharge: '', gasRate: '' },
    { id: '2', name: 'Tariff 2', elecStandingCharge: '', elecRate1: '', elecRate2: '', elecRate3: '', gasStandingCharge: '', gasRate: '' },
  ]);

  const updateTariff = (id: string, field: keyof TariffData, value: string) => {
    setTariffs(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const addTariff = () => {
    setTariffs(prev => [...prev, {
      id: Date.now().toString(),
      name: `Tariff ${prev.length + 1}`,
      elecStandingCharge: '', elecRate1: '', elecRate2: '', elecRate3: '', gasStandingCharge: '', gasRate: '',
    }]);
  };

  const removeTariff = (id: string) => {
    if (tariffs.length > 1) setTariffs(prev => prev.filter(t => t.id !== id));
  };

  const results = useMemo(() => {
    const u1 = parseFloat(elecUsage1) || 0;
    const u2 = parseFloat(elecUsage2) || 0;
    const u3 = parseFloat(elecUsage3) || 0;
    const gu = parseFloat(gasUsage) || 0;

    return tariffs.map(t => {
      const elecSC = (parseFloat(t.elecStandingCharge) || 0) / 100 * 365.25;
      const elecCost = ((parseFloat(t.elecRate1) || 0) / 100 * u1) + ((parseFloat(t.elecRate2) || 0) / 100 * u2) + ((parseFloat(t.elecRate3) || 0) / 100 * u3);
      const gasSC = (parseFloat(t.gasStandingCharge) || 0) / 100 * 365.25;
      const gasCost = ((parseFloat(t.gasRate) || 0) / 100 * gu);
      return {
        id: t.id,
        name: t.name,
        elecUsageCost: elecCost,
        elecStandingChargeCost: elecSC,
        gasUsageCost: gasCost,
        gasStandingChargeCost: gasSC,
        totalCost: elecCost + elecSC + gasCost + gasSC,
      };
    }).sort((a, b) => a.totalCost - b.totalCost);
  }, [tariffs, elecUsage1, elecUsage2, elecUsage3, gasUsage]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tariff Comparison Tool</h1>
        <p className="text-muted-foreground">Compare energy tariffs to find the best deal for customers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card className="frosted-glass">
            <CardHeader>
              <CardTitle>Energy Usage (Annual)</CardTitle>
              <CardDescription>Enter your annual usage in kWh for each rate.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1"><Label>Electricity Rate 1 (kWh)</Label><Input type="number" placeholder="e.g., 2000" value={elecUsage1} onChange={e => setElecUsage1(e.target.value)} /></div>
              <div className="space-y-1"><Label>Electricity Rate 2 (kWh)</Label><Input type="number" placeholder="e.g., 1000" value={elecUsage2} onChange={e => setElecUsage2(e.target.value)} /></div>
              <div className="space-y-1"><Label>Electricity Rate 3 (kWh)</Label><Input type="number" placeholder="e.g., 500" value={elecUsage3} onChange={e => setElecUsage3(e.target.value)} /></div>
              <div className="space-y-1"><Label>Gas Usage (kWh)</Label><Input type="number" placeholder="e.g., 12000" value={gasUsage} onChange={e => setGasUsage(e.target.value)} /></div>
            </CardContent>
          </Card>

          {tariffs.map((tariff) => (
            <Card key={tariff.id} className="frosted-glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{tariff.name}</CardTitle>
                    <CardDescription>Enter rates in pence.</CardDescription>
                  </div>
                  {tariffs.length > 1 && (
                    <Button variant="outline" size="icon" onClick={() => removeTariff(tariff.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1"><Label>Electricity Standing Charge (p/day)</Label><Input type="number" step="0.01" placeholder="e.g., 45.5" value={tariff.elecStandingCharge} onChange={e => updateTariff(tariff.id, 'elecStandingCharge', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Electricity Rate 1 (p/kWh)</Label><Input type="number" step="0.01" placeholder="e.g., 24.5" value={tariff.elecRate1} onChange={e => updateTariff(tariff.id, 'elecRate1', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Electricity Rate 2 (p/kWh)</Label><Input type="number" step="0.01" placeholder="e.g., 24.5" value={tariff.elecRate2} onChange={e => updateTariff(tariff.id, 'elecRate2', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Electricity Rate 3 (p/kWh)</Label><Input type="number" step="0.01" placeholder="e.g., 24.5" value={tariff.elecRate3} onChange={e => updateTariff(tariff.id, 'elecRate3', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Gas Standing Charge (p/day)</Label><Input type="number" step="0.01" placeholder="e.g., 28.5" value={tariff.gasStandingCharge} onChange={e => updateTariff(tariff.id, 'gasStandingCharge', e.target.value)} /></div>
                  <div className="space-y-1"><Label>Gas Rate (p/kWh)</Label><Input type="number" step="0.01" placeholder="e.g., 6.2" value={tariff.gasRate} onChange={e => updateTariff(tariff.id, 'gasRate', e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={addTariff} variant="outline" className="w-full">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Tariff
          </Button>
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-lg">Comparison</CardTitle>
              <CardDescription>Sorted by cheapest first</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Tariff</TableHead>
                    <TableHead className="text-right text-xs">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={r.id} className={i === 0 ? 'bg-green-500/10' : ''}>
                      <TableCell className="text-xs font-medium">{r.name}{i === 0 && ' ✓'}</TableCell>
                      <TableCell className="text-right text-xs font-semibold text-primary">£{r.totalCost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
