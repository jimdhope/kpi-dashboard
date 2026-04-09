'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';

export interface InstalmentPlanState {
  billedToDate: boolean;
  onBestTariff: boolean;
  summary?: string;
}

interface InstalmentPlanFlowProps {
  onStateChange: (state: InstalmentPlanState) => void;
}

export function InstalmentPlanFlow({ onStateChange }: InstalmentPlanFlowProps) {
  const [billedToDate, setBilledToDate] = useState(false);
  const [onBestTariff, setOnBestTariff] = useState(false);
  const [balance, setBalance] = useState('');
  const [months, setMonths] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);

  useEffect(() => {
    let summary: string;
    if (billedToDate && onBestTariff) {
      summary = 'Account billed to date. Customer confirmed on best tariff.';
    } else if (!billedToDate && !onBestTariff) {
      summary = 'Instalment plan prerequisites pending.';
    } else if (billedToDate) {
      summary = 'Account billed to date. Awaiting confirmation on best tariff.';
    } else {
      summary = 'Customer confirmed on best tariff. Awaiting account billed to date.';
    }

    onStateChange({
      billedToDate,
      onBestTariff,
      summary,
    });
  }, [billedToDate, onBestTariff, onStateChange]);

  const handleCalculate = () => {
    const balanceNum = parseFloat(balance);
    const monthsNum = parseInt(months, 10);
    if (!isNaN(balanceNum) && !isNaN(monthsNum) && monthsNum > 0) {
      setMonthlyPayment(balanceNum / monthsNum);
    } else {
      setMonthlyPayment(null);
    }
  };

  const prerequisitesMet = billedToDate && onBestTariff;

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <CardTitle>Process Flow: Set Up Instalment Plan</CardTitle>
        <CardDescription>Guide for setting up a payment instalment plan through the call flow.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Prerequisites</AlertTitle>
          <AlertDescription>
            Before setting up a plan, you must ensure the account is billed to date and the customer is on the best possible tariff.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prerequisite Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="billedToDate"
                checked={billedToDate}
                onCheckedChange={(checked) => setBilledToDate(checked as boolean)}
              />
              <Label htmlFor="billedToDate">Account is billed to date.</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="onBestTariff"
                checked={onBestTariff}
                onCheckedChange={(checked) => setOnBestTariff(checked as boolean)}
              />
              <Label htmlFor="onBestTariff">Customer is on the best tariff.</Label>
            </div>
          </CardContent>
        </Card>

        {prerequisitesMet && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instalment Plan Calculator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="balance">Balance (£)</Label>
                  <Input
                    id="balance"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 500.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="months">Months</Label>
                  <Input
                    id="months"
                    type="number"
                    min="1"
                    placeholder="e.g., 12"
                    value={months}
                    onChange={(e) => setMonths(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCalculate}>Calculate</Button>
              {monthlyPayment !== null && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">Monthly Payment</p>
                  <p className="text-2xl font-bold">£{monthlyPayment.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
