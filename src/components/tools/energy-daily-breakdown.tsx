'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { dailyRowsToCsv, type Currency, type DailyRow, type FuelSelection } from '@/lib/energy';

interface EnergyDailyBreakdownProps {
  rows: DailyRow[];
  selection: FuelSelection;
  currency: Currency;
  baselineNote: string;
}

export function EnergyDailyBreakdown({ rows, selection, currency, baselineNote }: EnergyDailyBreakdownProps) {
  const [inspectIndex, setInspectIndex] = useState<number | null>(null);

  const maxCost = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.totalCost), 0),
    [rows],
  );

  const inspected = inspectIndex !== null ? rows[inspectIndex] : null;

  function exportCsv() {
    const csv = dailyRowsToCsv(rows, selection, currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `energy-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const totalElectricKwh = rows.reduce((sum, row) => sum + row.elec1 + row.elec2 + row.elec3, 0);
  const totalElectricCost = rows.reduce((sum, row) => sum + row.electricCost, 0);
  const totalGasRaw = rows.reduce((sum, row) => sum + row.gasRaw, 0);
  const totalGasKwh = rows.reduce((sum, row) => sum + row.gasKwh, 0);
  const totalGasCost = rows.reduce((sum, row) => sum + row.gasCost, 0);
  const totalStanding = rows.reduce((sum, row) => sum + row.standingCost, 0);
  const grandTotal = rows.reduce((sum, row) => sum + row.totalCost, 0);

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Daily cost breakdown ({rows.length} days)</CardTitle>
            <CardDescription>{baselineNote}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} className="self-start sm:self-auto">
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="rounded-xl border border-border bg-muted/20 p-4"
          role="list"
          aria-label="Daily cost bar chart"
        >
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">Daily cost trend</span>
            <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
              {inspected
                ? `${inspected.date} — ${currency}${inspected.totalCost.toFixed(2)}`
                : 'Hover or tap a bar'}
            </span>
          </div>
          <div className="flex h-28 items-end gap-1 pt-2">
            {rows.map((row, index) => (
              <button
                key={row.date}
                type="button"
                role="listitem"
                aria-label={`${row.date}: ${currency}${row.totalCost.toFixed(2)}`}
                onClick={() => setInspectIndex(index)}
                onMouseMove={() => setInspectIndex(index)}
                onFocus={() => setInspectIndex(index)}
                className="flex-1 cursor-pointer rounded-t bg-primary/70 transition-all hover:bg-primary focus-visible:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ height: `${Math.max(6, maxCost > 0 ? Math.round((row.totalCost / maxCost) * 100) : 6)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {selection.electric && <TableHead className="text-right">Elec (kWh)</TableHead>}
                {selection.electric && <TableHead className="text-right">Elec cost</TableHead>}
                {selection.gas && <TableHead className="text-right">Gas raw</TableHead>}
                {selection.gas && <TableHead className="text-right">Gas (kWh)</TableHead>}
                {selection.gas && <TableHead className="text-right">Gas cost</TableHead>}
                <TableHead className="text-right">Standing</TableHead>
                <TableHead className="text-right">Day total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.date}>
                  <TableCell className="whitespace-nowrap font-medium">{row.date}</TableCell>
                  {selection.electric && (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {(row.elec1 + row.elec2 + row.elec3).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {currency}
                        {row.electricCost.toFixed(2)}
                      </TableCell>
                    </>
                  )}
                  {selection.gas && (
                    <>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.gasRaw.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.gasKwh.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {currency}
                        {row.gasCost.toFixed(2)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {currency}
                    {row.standingCost.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {currency}
                    {row.totalCost.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total ({rows.length} days)</TableCell>
                {selection.electric && (
                  <>
                    <TableCell className="text-right tabular-nums">{totalElectricKwh.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {currency}
                      {totalElectricCost.toFixed(2)}
                    </TableCell>
                  </>
                )}
                {selection.gas && (
                  <>
                    <TableCell className="text-right tabular-nums">{totalGasRaw.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{totalGasKwh.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {currency}
                      {totalGasCost.toFixed(2)}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-right tabular-nums">
                  {currency}
                  {totalStanding.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-primary">
                  {currency}
                  {grandTotal.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
