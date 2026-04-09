'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface MeterReadingsState {
  elecReadings?: string;
  gasReadings?: string;
  summary?: string;
}

interface SubmitMeterReadingsFlowProps {
  onStateChange: (state: MeterReadingsState) => void;
}

export function SubmitMeterReadingsFlow({ onStateChange }: SubmitMeterReadingsFlowProps) {
  const { toast } = useToast();

  const [fuelType, setFuelType] = useState<'electric' | 'gas' | 'both'>('both');
  const [numElectricRates, setNumElectricRates] = useState<1 | 2 | 3>(1);
  const [elecRate1, setElecRate1] = useState('');
  const [elecRate2, setElecRate2] = useState('');
  const [elecRate3, setElecRate3] = useState('');
  const [gasReading, setGasReading] = useState('');
  const [billingOutcome, setBillingOutcome] = useState<'billed' | 'billed_4_days' | 'back_office_10' | 'back_office_15' | ''>('');
  const [billAmount, setBillAmount] = useState('');

  useEffect(() => {
    const elecParts: string[] = [];
    if (fuelType === 'electric' || fuelType === 'both') {
      if (elecRate1) elecParts.push(`R1: ${elecRate1}`);
      if (numElectricRates >= 2 && elecRate2) elecParts.push(`R2: ${elecRate2}`);
      if (numElectricRates >= 3 && elecRate3) elecParts.push(`R3: ${elecRate3}`);
    }

    const elecReadings = elecParts.length > 0 ? elecParts.join(', ') : undefined;
    const gasReadings = (fuelType === 'gas' || fuelType === 'both') && gasReading ? gasReading : undefined;

    let outcomeSummary = '';
    if (billingOutcome === 'billed') {
      outcomeSummary = billAmount ? `Bill Produced: £${billAmount}` : 'Bill Produced';
    } else if (billingOutcome === 'billed_4_days') {
      outcomeSummary = 'No bill - billed in last 4 days';
    } else if (billingOutcome === 'back_office_10') {
      outcomeSummary = 'No bill - sent to back office (10 working days)';
    } else if (billingOutcome === 'back_office_15') {
      outcomeSummary = 'No bill - sent to back office (15 working days)';
    }

    const summaryParts: string[] = [];
    if (elecReadings || gasReadings) {
      const readingStr = [];
      if (elecReadings) readingStr.push(`Elec (${elecReadings})`);
      if (gasReadings) readingStr.push(`Gas (${gasReadings})`);
      summaryParts.push(`${readingStr.join(' & ')} readings provided.`);
    }
    if (outcomeSummary) {
      summaryParts.push(outcomeSummary);
    }

    onStateChange({
      elecReadings,
      gasReadings,
      summary: summaryParts.join(' '),
    });
  }, [fuelType, numElectricRates, elecRate1, elecRate2, elecRate3, gasReading, billingOutcome, billAmount, onStateChange]);

  const handleCopyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Text copied to clipboard.',
    });
  };

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <CardTitle>Process Flow: Bill Account with Readings</CardTitle>
        <CardDescription>Guide for billing a customer&apos;s account using meter readings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="how-to-bill">
            <AccordionTrigger>How to Bill the Account in UI5</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Navigate to the customer&apos;s account in UI5.</li>
                <li>Click on <strong>Meter Readings</strong> in the left-hand menu.</li>
                <li>Select the relevant meter (Electricity Rate 1, Rate 2, Rate 3, or Gas).</li>
                <li>Enter the reading provided by the customer and click <strong>Submit</strong>.</li>
                <li>Once readings are submitted, navigate to <strong>Billing</strong> and select <strong>Bill Account</strong>.</li>
                <li>Review the bill details and confirm the billing outcome.</li>
                <li>If a bill is produced, note the amount. If not, record the reason and any back office referral.</li>
              </ol>
              <Alert className="mt-4">
                <Lightbulb className="h-4 w-4" />
                <AlertTitle>Tip</AlertTitle>
                <AlertDescription>
                  Always double-check the reading before submitting. Incorrect readings can lead to inaccurate bills and customer complaints.
                </AlertDescription>
              </Alert>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Billing Outcome</Label>
          <RadioGroup value={billingOutcome} onValueChange={(value) => setBillingOutcome(value as typeof billingOutcome)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="billed" id="outcome-billed" />
              <Label htmlFor="outcome-billed">Bill Produced</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="billed_4_days" id="outcome-4days" />
              <Label htmlFor="outcome-4days">No Bill - Billed in last 4 days</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="back_office_10" id="outcome-back10" />
              <Label htmlFor="outcome-back10">No Bill - Sent to back office (10 working days)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="back_office_15" id="outcome-back15" />
              <Label htmlFor="outcome-back15">No Bill - Sent to back office (15 working days)</Label>
            </div>
          </RadioGroup>
          {billingOutcome === 'billed' && (
            <div className="space-y-2 mt-2">
              <Label htmlFor="billAmount">Bill Amount (£)</Label>
              <Input
                id="billAmount"
                type="number"
                placeholder="Enter bill amount"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
              />
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Note Meter Readings</Label>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleCopyToClipboard(
              [
                fuelType === 'electric' || fuelType === 'both' ? `Elec R1: ${elecRate1 || '-'}, R2: ${elecRate2 || '-'}, R3: ${elecRate3 || '-'}` : '',
                fuelType === 'gas' || fuelType === 'both' ? `Gas: ${gasReading || '-'}` : '',
              ].filter(Boolean).join(' | ')
            )}>
              Copy Readings <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Fuel Type</Label>
            <RadioGroup value={fuelType} onValueChange={(value) => setFuelType(value as typeof fuelType)} className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="electric" id="fuel-electric" />
                <Label htmlFor="fuel-electric">Electric Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="gas" id="fuel-gas" />
                <Label htmlFor="fuel-gas">Gas Only</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="fuel-both" />
                <Label htmlFor="fuel-both">Both</Label>
              </div>
            </RadioGroup>
          </div>

          {(fuelType === 'electric' || fuelType === 'both') && (
            <div className="space-y-2">
              <Label>Number of Electric Rates</Label>
              <RadioGroup value={String(numElectricRates)} onValueChange={(value) => setNumElectricRates(Number(value) as 1 | 2 | 3)} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1" id="rates-1" />
                  <Label htmlFor="rates-1">1 Rate</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="rates-2" />
                  <Label htmlFor="rates-2">2 Rates</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="rates-3" />
                  <Label htmlFor="rates-3">3 Rates</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(fuelType === 'electric' || fuelType === 'both') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="elecRate1">Electricity Rate 1</Label>
                  <Input id="elecRate1" placeholder="Enter Rate 1 reading" value={elecRate1} onChange={(e) => setElecRate1(e.target.value)} />
                </div>
                {numElectricRates >= 2 && (
                  <div className="space-y-2">
                    <Label htmlFor="elecRate2">Electricity Rate 2</Label>
                    <Input id="elecRate2" placeholder="Enter Rate 2 reading" value={elecRate2} onChange={(e) => setElecRate2(e.target.value)} />
                  </div>
                )}
                {numElectricRates >= 3 && (
                  <div className="space-y-2">
                    <Label htmlFor="elecRate3">Electricity Rate 3</Label>
                    <Input id="elecRate3" placeholder="Enter Rate 3 reading" value={elecRate3} onChange={(e) => setElecRate3(e.target.value)} />
                  </div>
                )}
              </>
            )}
            {(fuelType === 'gas' || fuelType === 'both') && (
              <div className="space-y-2">
                <Label htmlFor="gasReading">Gas Reading</Label>
                <Input id="gasReading" placeholder="Enter gas reading" value={gasReading} onChange={(e) => setGasReading(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
