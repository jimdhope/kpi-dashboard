'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  MAX_FILE_SPAN_DAYS,
  computeDailyRows,
  computeManualSummary,
  dailyRowsToCsv,
  extractReadings,
  mergeReadings,
  readingsSpanDays,
  summariseDailyRows,
  type Currency,
  type DailyRow,
  type EnergySummary,
  type EnergyTariff,
  type Fuel,
  type GasUnit,
  type ManualInputMode,
  type MeterReading,
} from '@/lib/energy';
import { EnergyDailyBreakdown } from '@/components/tools/energy-daily-breakdown';

type Mode = 'upload' | 'manual';
type FuelType = 'electric' | 'gas' | 'both';
type MessageType = 'info' | 'success' | 'error';
type Message = { text: string; type: MessageType } | null;

interface FileInfo {
  name: string;
  readingCount: number;
  spanDays: number | null;
}


function emptyReadings(): Record<Fuel, Record<string, MeterReading>> {
  return { electric: {}, gas: {} };
}

function emptyFiles(): Record<Fuel, FileInfo[]> {
  return { electric: [], gas: [] };
}

export function EnergyCalculator() {
  const [mode, setMode] = useState<Mode>('manual');
  const [fuelType, setFuelType] = useState<FuelType>('electric');
  const [numRates, setNumRates] = useState<1 | 2 | 3>(1);
  const [currency, setCurrency] = useState<Currency>('£');
  const [gasUnit, setGasUnit] = useState<GasUnit>('metric');

  const [elecRates, setElecRates] = useState<string[]>(['24.50', '', '']);
  const [elecStanding, setElecStanding] = useState('60.99');
  const [gasRate, setGasRate] = useState('6.24');
  const [gasStanding, setGasStanding] = useState('31.65');

  const [readings, setReadings] = useState<Record<Fuel, Record<string, MeterReading>>>(emptyReadings);
  const [fileInfos, setFileInfos] = useState<Record<Fuel, FileInfo[]>>(emptyFiles);
  const [message, setMessage] = useState<Message>(null);
  const [dragging, setDragging] = useState<Fuel | null>(null);

  const elecInputRef = useRef<HTMLInputElement>(null);
  const gasInputRef = useRef<HTMLInputElement>(null);

  const [manualMode, setManualMode] = useState<ManualInputMode>('readings');
  const [startDate, setStartDate] = useState('2026-10-20');
  const [endDate, setEndDate] = useState('2026-11-19');
  const [manualTiers, setManualTiers] = useState([
    { start: '44498', end: '44870', units: '372' },
    { start: '', end: '', units: '' },
    { start: '', end: '', units: '' },
  ]);
  const [gasStart, setGasStart] = useState('');
  const [gasEnd, setGasEnd] = useState('');
  const [gasUnits, setGasUnits] = useState('');

  const selection = useMemo(
    () => ({ electric: fuelType === 'electric' || fuelType === 'both', gas: fuelType === 'gas' || fuelType === 'both' }),
    [fuelType],
  );

  const tariff: EnergyTariff = useMemo(
    () => ({
      electricRates: [0, 1, 2].slice(0, numRates).map((index) => parseFloat(elecRates[index]) || 0),
      electricStanding: parseFloat(elecStanding) || 0,
      gasRate: parseFloat(gasRate) || 0,
      gasStanding: parseFloat(gasStanding) || 0,
      gasUnit,
    }),
    [elecRates, elecStanding, gasRate, gasStanding, gasUnit, numRates],
  );

  const allReadings = useMemo(() => {
    const merged: MeterReading[] = [];
    for (const fuel of ['electric', 'gas'] as Fuel[]) {
      merged.push(...Object.values(readings[fuel]));
    }
    return merged;
  }, [readings]);

  const dailyRows: DailyRow[] = useMemo(
    () => (mode === 'upload' ? computeDailyRows(allReadings, tariff, selection) : []),
    [allReadings, mode, selection, tariff],
  );

  const uploadSummary: EnergySummary | null = useMemo(
    () => (mode === 'upload' && dailyRows.length > 0 ? summariseDailyRows(dailyRows, tariff) : null),
    [dailyRows, mode, tariff],
  );

  const manualSummary: EnergySummary | null = useMemo(
    () => (mode === 'manual' ? computeManualSummary({
      startDate,
      endDate,
      mode: manualMode,
      tiers: manualTiers,
      electricRates: tariff.electricRates,
      electricStanding: tariff.electricStanding,
      gas: { start: gasStart, end: gasEnd, units: gasUnits, unit: gasUnit },
      gasRate: tariff.gasRate,
      gasStanding: tariff.gasStanding,
      selection,
    }) : null),
    [mode, startDate, endDate, manualMode, manualTiers, tariff, gasStart, gasEnd, gasUnits, gasUnit, selection],
  );

  const summary = mode === 'upload' ? uploadSummary : manualSummary;

  const baselineNote = useMemo(() => {
    const notes: string[] = [];
    for (const fuel of ['electric', 'gas'] as Fuel[]) {
      if (!selection[fuel]) continue;
      const values = Object.values(readings[fuel]).sort((a, b) => a.date.localeCompare(b.date));
      if (values.length > 0) {
        notes.push(`${fuel === 'electric' ? 'Elec' : 'Gas'} opening baseline (${values[0].date}): ${values[0].total.toLocaleString()}`);
      }
    }
    return notes.join('  •  ');
  }, [readings, selection]);

  const processFiles = useCallback(
    async (fuel: Fuel, fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setMessage(null);
      let importedRows = 0;
      const mergedIncoming: MeterReading[] = [];
      const infos: FileInfo[] = [];

      try {
        for (const file of files) {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

          if (rows.length === 0) throw new Error(`File "${file.name}" appears to be empty.`);

          const { readings: extracted } = extractReadings(rows, fuel, file.name);
          if (extracted.length === 0) {
            throw new Error(`No usable "Date" and "Total"/"Register" columns found in "${file.name}".`);
          }

          mergedIncoming.push(...extracted);
          importedRows += extracted.length;
          infos.push({
            name: file.name,
            readingCount: extracted.length,
            spanDays: readingsSpanDays(extracted),
          });
        }

        setReadings((current) => ({
          ...current,
          [fuel]: mergeReadings(current[fuel], mergedIncoming),
        }));
        setFileInfos((current) => {
          const existing = current[fuel];
          const merged = [...existing];
          for (const info of infos) {
            const index = merged.findIndex((entry) => entry.name === info.name);
            if (index >= 0) merged[index] = info;
            else merged.push(info);
          }
          return { ...current, [fuel]: merged };
        });
        setMessage({
          type: 'success',
          text: `Loaded ${files.length} ${fuel} file(s) — ${importedRows} readings merged in your browser. Nothing was uploaded to a server.`,
        });
      } catch (error) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Error reading spreadsheet file.',
        });
      }
    },
    [],
  );

  const removeFile = useCallback((fuel: Fuel, name: string) => {
    setReadings((current) => {
      const next = { ...current[fuel] };
      for (const reading of Object.values(next)) {
        if (reading.sourceFile === name) delete next[reading.date];
      }
      return { ...current, [fuel]: next };
    });
    setFileInfos((current) => ({
      ...current,
      [fuel]: current[fuel].filter((info) => info.name !== name),
    }));
  }, []);

  const clearFuel = useCallback((fuel: Fuel) => {
    setReadings((current) => ({ ...current, [fuel]: {} }));
    setFileInfos((current) => ({ ...current, [fuel]: [] }));
  }, []);

  const exportCsv = useCallback(() => {
    if (dailyRows.length === 0) return;
    const csv = dailyRowsToCsv(dailyRows, selection, currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `energy-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currency, dailyRows, selection]);

  const showElectric = selection.electric;
  const showGas = selection.gas;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-lg font-semibold tracking-tight">Energy Calculator</p>
        <p className="text-sm text-muted-foreground">
          Upload monthly meter exports or enter readings manually — switch fuels, tiers and currency.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={
            message.type === 'error'
              ? 'flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive'
              : message.type === 'success'
                ? 'flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500'
                : 'flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary'
          }
        >
          <div className="flex items-center gap-2.5">
            {message.type === 'error' && <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />}
            {message.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />}
            {message.type === 'info' && <Info className="h-5 w-5 shrink-0" aria-hidden="true" />}
            <span className="font-medium">{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-xs underline opacity-75 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-4">
          <Card className="frosted-glass">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Choose an input workflow, fuel types and tariff structure.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Data input source</Label>
                <RadioGroup value={mode} onValueChange={(value) => setMode(value as Mode)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { value: 'upload', title: 'Upload meter export files', hint: 'Multi-file, one fuel per file, day-by-day breakdown' },
                    { value: 'manual', title: 'Manual entry', hint: 'Start/end readings or direct kWh for a date range' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={
                        mode === option.value
                          ? 'flex cursor-pointer items-start gap-3 rounded-xl border-2 border-primary bg-primary/5 p-3.5 transition'
                          : 'flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border p-3.5 transition hover:border-primary/50'
                      }
                    >
                      <RadioGroupItem value={option.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="block text-xs text-muted-foreground">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fuel type</Label>
                  <RadioGroup value={fuelType} onValueChange={(value) => setFuelType(value as FuelType)} className="flex flex-wrap gap-4 pt-1">
                    {[
                      { value: 'electric', label: 'Electricity only' },
                      { value: 'gas', label: 'Gas only' },
                      { value: 'both', label: 'Gas & electricity' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <RadioGroupItem value={option.value} />
                        {option.label}
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {showElectric && (
                  <div className="space-y-2">
                    <Label>Electricity rates</Label>
                    <RadioGroup
                      value={String(numRates)}
                      onValueChange={(value) => setNumRates(Number(value) as 1 | 2 | 3)}
                      className="flex flex-wrap gap-4 pt-1"
                    >
                      {([1, 2, 3] as const).map((count) => (
                        <label key={count} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                          <RadioGroupItem value={String(count)} />
                          {count} {count === 1 ? 'rate' : 'rates'}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="energy-currency">Currency</Label>
                  <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                    <SelectTrigger id="energy-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="£">GBP (£)</SelectItem>
                      <SelectItem value="€">EUR (€)</SelectItem>
                      <SelectItem value="$">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="energy-gas-unit">Gas meter unit</Label>
                  <Select value={gasUnit} onValueChange={(value) => setGasUnit(value as GasUnit)}>
                    <SelectTrigger id="energy-gas-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Metric (m³)</SelectItem>
                      <SelectItem value="imperial">Imperial (ft³)</SelectItem>
                      <SelectItem value="kwh">Already kWh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {mode === 'manual' && (
            <>
              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Date range</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="energy-start-date">Start date</Label>
                    <Input id="energy-start-date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="energy-end-date">End date</Label>
                    <Input id="energy-end-date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Number of days</Label>
                    <Input readOnly value={summary?.days ?? ''} placeholder="Calculated" />
                  </div>
                </CardContent>
              </Card>

              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Usage input method</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={manualMode}
                    onValueChange={(value) => setManualMode(value as ManualInputMode)}
                    className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                  >
                    {[
                      { value: 'readings', label: 'Calculate from meter readings' },
                      { value: 'direct', label: 'Enter usage directly (kWh)' },
                    ].map((option) => (
                      <label key={option.value} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <RadioGroupItem value={option.value} />
                        {option.label}
                      </label>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            </>
          )}

          <div className={showElectric && showGas ? 'grid grid-cols-1 gap-6 md:grid-cols-2' : 'grid grid-cols-1 gap-6'}>
            {showElectric && (
              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Electricity details</CardTitle>
                  <CardDescription>
                    {mode === 'upload' ? 'Upload one file per month — each file is electricity only.' : 'Enter readings or usage per rate.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mode === 'upload' && (
                    <UploadControl
                      fuel="electric"
                      label="Upload electricity exports"
                      files={fileInfos.electric}
                      inputRef={elecInputRef}
                      dragging={dragging === 'electric'}
                      onDraggingChange={(isDragging) => setDragging(isDragging ? 'electric' : null)}
                      onFiles={(list) => void processFiles('electric', list)}
                      onRemove={(name) => removeFile('electric', name)}
                      onClear={() => clearFuel('electric')}
                    />
                  )}

                  {mode === 'manual' && (
                    <div className="space-y-3">
                      {manualTiers.slice(0, numRates).map((tier, index) => (
                        <div key={index} className="space-y-2 rounded-xl border border-border p-3">
                          <Label>Electricity rate {index + 1}</Label>
                          {manualMode === 'readings' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Start (kWh)</Label>
                                <Input
                                  type="number"
                                  step="any"
                                  value={tier.start}
                                  onChange={(event) => {
                                    const next = [...manualTiers];
                                    next[index] = { ...next[index], start: event.target.value };
                                    setManualTiers(next);
                                  }}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">End (kWh)</Label>
                                <Input
                                  type="number"
                                  step="any"
                                  value={tier.end}
                                  onChange={(event) => {
                                    const next = [...manualTiers];
                                    next[index] = { ...next[index], end: event.target.value };
                                    setManualTiers(next);
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Units used (kWh)</Label>
                              <Input
                                type="number"
                                step="any"
                                value={tier.units}
                                onChange={(event) => {
                                  const next = [...manualTiers];
                                  next[index] = { ...next[index], units: event.target.value };
                                  setManualTiers(next);
                                }}
                              />
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Rate (p/kWh)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={elecRates[index]}
                              onChange={(event) => {
                                const next = [...elecRates];
                                next[index] = event.target.value;
                                setElecRates(next);
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {mode === 'upload' && (
                    <div className="space-y-3">
                      {Array.from({ length: numRates }).map((_, index) => (
                        <div key={index} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Rate {index + 1} (p/kWh)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={elecRates[index]}
                            onChange={(event) => {
                              const next = [...elecRates];
                              next[index] = event.target.value;
                              setElecRates(next);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="energy-elec-standing">Standing charge (p/day)</Label>
                    <Input id="energy-elec-standing" type="number" step="0.01" value={elecStanding} onChange={(event) => setElecStanding(event.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {showGas && (
              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Gas details</CardTitle>
                  <CardDescription>
                    {mode === 'upload' ? 'Upload one file per month — each file is gas only.' : 'Enter readings or usage.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mode === 'upload' && (
                    <UploadControl
                      fuel="gas"
                      label="Upload gas exports"
                      files={fileInfos.gas}
                      inputRef={gasInputRef}
                      dragging={dragging === 'gas'}
                      onDraggingChange={(isDragging) => setDragging(isDragging ? 'gas' : null)}
                      onFiles={(list) => void processFiles('gas', list)}
                      onRemove={(name) => removeFile('gas', name)}
                      onClear={() => clearFuel('gas')}
                    />
                  )}

                  {mode === 'manual' && manualMode === 'readings' && (
                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <Label>Gas readings</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Start ({gasUnit === 'imperial' ? 'ft³' : gasUnit === 'metric' ? 'm³' : 'kWh'})</Label>
                          <Input type="number" step="any" value={gasStart} onChange={(event) => setGasStart(event.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">End ({gasUnit === 'imperial' ? 'ft³' : gasUnit === 'metric' ? 'm³' : 'kWh'})</Label>
                          <Input type="number" step="any" value={gasEnd} onChange={(event) => setGasEnd(event.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'manual' && manualMode === 'direct' && (
                    <div className="space-y-1">
                      <Label htmlFor="energy-gas-units">Gas units used (kWh)</Label>
                      <Input id="energy-gas-units" type="number" step="any" value={gasUnits} onChange={(event) => setGasUnits(event.target.value)} />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="energy-gas-rate">Gas rate (p/kWh)</Label>
                    <Input id="energy-gas-rate" type="number" step="0.01" value={gasRate} onChange={(event) => setGasRate(event.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="energy-gas-standing">Standing charge (p/day)</Label>
                    <Input id="energy-gas-standing" type="number" step="0.01" value={gasStanding} onChange={(event) => setGasStanding(event.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {mode === 'upload' && dailyRows.length > 0 && (
            <EnergyDailyBreakdown rows={dailyRows} selection={selection} currency={currency} baselineNote={baselineNote} />
          )}

          {mode === 'upload' && dailyRows.length === 0 && (
            <Card className="frosted-glass">
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <FileSpreadsheet className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <h3 className="mb-1 text-lg font-semibold">No readings loaded</h3>
                <p className="mb-3 max-w-sm text-sm text-muted-foreground">
                  Upload at least two daily electricity or gas readings to see usage and costs.
                </p>
              </div>
            </Card>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:col-span-1">
          <Card className="frosted-glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!summary && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {mode === 'upload'
                    ? 'Upload at least two daily meter readings (or load the sample export) to see usage and costs.'
                    : 'Enter a valid date range and readings to see the summary.'}
                </p>
              )}

              {summary && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days</span>
                    <span className="font-semibold">{summary.days}</span>
                  </div>
                  <Separator />

                  {showElectric && (
                    <>
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">Electricity</div>
                      <SummaryRow label={`Rate 1`} value={`${summary.elec1.toFixed(2)} kWh @ ${currency}${summary.elec1Cost.toFixed(2)}`} />
                      {numRates >= 2 && <SummaryRow label="Rate 2" value={`${summary.elec2.toFixed(2)} kWh @ ${currency}${summary.elec2Cost.toFixed(2)}`} />}
                      {numRates >= 3 && <SummaryRow label="Rate 3" value={`${summary.elec3.toFixed(2)} kWh @ ${currency}${summary.elec3Cost.toFixed(2)}`} />}
                      <SummaryRow label="Standing" value={`${currency}${summary.electricStanding.toFixed(2)}`} />
                      <SummaryRow label="Subtotal" value={`${currency}${(summary.electricCost + summary.electricStanding).toFixed(2)}`} bold />
                      <Separator />
                    </>
                  )}

                  {showGas && (
                    <>
                      <div className="text-xs font-bold uppercase tracking-wider text-primary">Gas</div>
                      <SummaryRow label="Usage" value={`${summary.gasKwh.toFixed(2)} kWh @ ${currency}${summary.gasCost.toFixed(2)}`} />
                      <SummaryRow label="Standing" value={`${currency}${summary.gasStanding.toFixed(2)}`} />
                      <SummaryRow label="Subtotal" value={`${currency}${(summary.gasCost + summary.gasStanding).toFixed(2)}`} bold />
                      <Separator />
                    </>
                  )}

                  <div className="flex items-center justify-between pt-1 text-base font-bold text-primary">
                    <span>Total cost</span>
                    <span>
                      {currency}
                      {summary.totalCost.toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <SummaryRow label="Daily avg" value={`${currency}${summary.dailyCost.toFixed(2)}`} />
                  <SummaryRow label="Monthly est." value={`${currency}${summary.monthlyCost.toFixed(2)}`} />
                  <SummaryRow label="Yearly est." value={`${currency}${summary.yearlyCost.toFixed(2)}`} />
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between pl-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : undefined}>{value}</span>
    </div>
  );
}

interface UploadControlProps {
  fuel: Fuel;
  label: string;
  files: FileInfo[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
}

function UploadControl({ fuel, label, files, inputRef, dragging, onDraggingChange, onFiles, onRemove, onClear }: UploadControlProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <label
        htmlFor={`energy-${fuel}-input`}
        onDragOver={(event) => {
          event.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDraggingChange(false);
          if (event.dataTransfer?.files) onFiles(event.dataTransfer.files);
        }}
        className={
          dragging
            ? 'flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 p-3 text-center transition'
            : 'flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-3 text-center transition hover:border-primary/60 hover:bg-primary/5'
        }
      >
        <Upload className="mb-1 h-6 w-6 text-primary" aria-hidden="true" />
        <span className="text-xs font-semibold">Click or drop .xlsx, .xls or .csv files</span>
        <span className="text-[11px] text-muted-foreground">One fuel per file, one month per file — add a file per month</span>
        <input
          id={`energy-${fuel}-input`}
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) onFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </label>

      {files.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {files.map((file) => {
            const overSpan = file.spanDays !== null && file.spanDays > MAX_FILE_SPAN_DAYS;
            return (
              <div key={file.name} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {file.readingCount} readings
                    {file.spanDays !== null ? ` • ${file.spanDays} days` : ''}
                    {overSpan ? ' • exceeds one month' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(file.name)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={onClear}>
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
