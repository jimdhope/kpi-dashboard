'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export function DualFuelCalculator() {
  const [ongoingElecUsage, setOngoingElecUsage] = useState('');
  const [elecBalance, setElecBalance] = useState('');
  const [ongoingGasUsage, setOngoingGasUsage] = useState('');
  const [gasBalance, setGasBalance] = useState('');

  const result = useMemo(() => {
    const elecUsage = parseFloat(ongoingElecUsage) || 0;
    const elecBal = parseFloat(elecBalance) || 0;
    const gasUsage = parseFloat(ongoingGasUsage) || 0;
    const gasBal = parseFloat(gasBalance) || 0;

    const elecMonthlyInstalment = elecBal / 12;
    const elecMonthlyTotal = elecMonthlyInstalment + elecUsage;
    const gasMonthlyInstalment = gasBal / 12;
    const gasMonthlyTotal = gasMonthlyInstalment + gasUsage;
    const totalMonthlyPayment = elecMonthlyTotal + gasMonthlyTotal;

    return { elecMonthlyInstalment, elecMonthlyTotal, gasMonthlyInstalment, gasMonthlyTotal, totalMonthlyPayment };
  }, [ongoingElecUsage, elecBalance, ongoingGasUsage, gasBalance]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4">
          <Card className="frosted-glass">
            <CardHeader>
              <CardTitle>Balance & Usage</CardTitle>
              <CardDescription>Enter your balances and ongoing monthly usage for both fuels.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-primary">Electricity</h4>
                <div className="space-y-2">
                  <Label htmlFor="elecBalance">Electricity Balance (£)</Label>
                  <Input id="elecBalance" type="number" placeholder="e.g., 600" value={elecBalance} onChange={e => setElecBalance(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ongoingElecUsage">Ongoing Electricity Usage (£/month)</Label>
                  <Input id="ongoingElecUsage" type="number" placeholder="e.g., 50" value={ongoingElecUsage} onChange={e => setOngoingElecUsage(e.target.value)} />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-primary">Gas</h4>
                <div className="space-y-2">
                  <Label htmlFor="gasBalance">Gas Balance (£)</Label>
                  <Input id="gasBalance" type="number" placeholder="e.g., 400" value={gasBalance} onChange={e => setGasBalance(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ongoingGasUsage">Ongoing Gas Usage (£/month)</Label>
                  <Input id="ongoingGasUsage" type="number" placeholder="e.g., 40" value={ongoingGasUsage} onChange={e => setOngoingGasUsage(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader><CardTitle className="text-lg">Monthly Payment</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Electricity</h4>
                <div className="flex justify-between"><span className="text-muted-foreground">Instalment:</span><span>£{result.elecMonthlyInstalment.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Usage:</span><span>£{(parseFloat(ongoingElecUsage) || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-medium"><span>Total:</span><span>£{result.elecMonthlyTotal.toFixed(2)}</span></div>
              </div>
              <Separator />
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Gas</h4>
                <div className="flex justify-between"><span className="text-muted-foreground">Instalment:</span><span>£{result.gasMonthlyInstalment.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Usage:</span><span>£{(parseFloat(ongoingGasUsage) || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-medium"><span>Total:</span><span>£{result.gasMonthlyTotal.toFixed(2)}</span></div>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold text-primary">
                <span>Total:</span>
                <span>£{result.totalMonthlyPayment.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
