export type Fuel = 'electric' | 'gas';
export type GasUnit = 'metric' | 'imperial' | 'kwh';
export type Currency = '£' | '€' | '$';
export type ManualInputMode = 'readings' | 'direct';

export interface MeterReading {
  date: string;
  fuel: Fuel;
  register1: number;
  register2: number;
  register3: number;
  total: number;
  sourceFile: string;
}

export interface EnergyTariff {
  /** pence per kWh, index 0 = register 1 */
  electricRates: number[];
  /** pence per day */
  electricStanding: number;
  /** pence per kWh */
  gasRate: number;
  /** pence per day */
  gasStanding: number;
  gasUnit: GasUnit;
}

export interface FuelSelection {
  electric: boolean;
  gas: boolean;
}

export interface DailyRow {
  date: string;
  elec1: number;
  elec2: number;
  elec3: number;
  electricCost: number;
  gasRaw: number;
  gasKwh: number;
  gasCost: number;
  standingCost: number;
  totalCost: number;
}

export interface EnergySummary {
  days: number;
  elec1: number;
  elec2: number;
  elec3: number;
  elec1Cost: number;
  elec2Cost: number;
  elec3Cost: number;
  electricKwh: number;
  electricCost: number;
  electricStanding: number;
  gasRaw: number;
  gasKwh: number;
  gasCost: number;
  gasStanding: number;
  totalCost: number;
  dailyCost: number;
  monthlyCost: number;
  yearlyCost: number;
}

export interface ManualTierInput {
  start: string;
  end: string;
  units: string;
}

export interface ManualInput {
  startDate: string;
  endDate: string;
  mode: ManualInputMode;
  tiers: ManualTierInput[];
  electricRates: number[];
  electricStanding: number;
  gas: { start: string; end: string; units: string; unit: GasUnit };
  gasRate: number;
  gasStanding: number;
  selection: FuelSelection;
}

export const IMPERIAL_FT3_TO_M3_FACTOR = 0.0283168;
export const VOLUME_CORRECTION_FACTOR = 1.02264;
export const CALORIFIC_VALUE = 40.0;
export const KWH_CONVERSION_DIVISOR = 3.6;
export const AVG_DAYS_IN_MONTH = 30.4375;
export const DAY_MS = 86_400_000;
/** A source export covers at most one month. */
export const MAX_FILE_SPAN_DAYS = 31;

export function convertGasToKwh(rawUnits: number, unit: GasUnit): number {
  if (!Number.isFinite(rawUnits) || rawUnits <= 0) return 0;
  if (unit === 'kwh') return rawUnits;
  if (unit === 'metric') {
    return (rawUnits * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE) / KWH_CONVERSION_DIVISOR;
  }
  return (rawUnits * IMPERIAL_FT3_TO_M3_FACTOR * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE) / KWH_CONVERSION_DIVISOR;
}

/** Excel serial day number → YYYY-MM-DD (epoch 1899-12-30). Deterministic and
 * independent of the SSF engine, which is not present under our ESM import
 * conditions (browser and test runner). Only accurate for serials >= 60. */
export function serialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = Date.UTC(1899, 11, 30) + serial * DAY_MS;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Normalise the many date shapes a meter export can contain into YYYY-MM-DD. */
export function formatExcelDate(raw: unknown): string | null {
  if (!raw) return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    // Compensate for the timezone offset so local Excel dates do not shift by a day.
    const offsetMs = raw.getTimezoneOffset() * 60_000;
    return new Date(raw.getTime() - offsetMs).toISOString().slice(0, 10);
  }

  if (typeof raw === 'number') return serialToDate(raw);

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

    const ukMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ukMatch) {
      return `${ukMatch[3]}-${ukMatch[2].padStart(2, '0')}-${ukMatch[1].padStart(2, '0')}`;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  return null;
}

export interface DetectedColumns {
  dateKey: string | null;
  totalKey: string | null;
  registerKeys: string[];
}

/**
 * Auto-detect the columns a meter export uses. Looks for a date/timestamp
 * column, an optional total column and up to three register columns.
 */
export function detectColumns(rows: Array<Record<string, unknown>>): DetectedColumns {
  if (rows.length === 0) return { dateKey: null, totalKey: null, registerKeys: [] };

  const keys = Object.keys(rows[0]);
  const dateKey = keys.find((key) => /date|timestamp/.test(key.toLowerCase())) ?? null;
  const totalKey = keys.find((key) => key.toLowerCase().includes('total')) ?? null;

  const registerKeys: string[] = [];
  for (let register = 1; register <= 3; register += 1) {
    const pattern = new RegExp(`^(register|reg|reading|r)\\s*${register}\\b`);
    const match = keys.find((key) => pattern.test(key.toLowerCase()));
    if (match) registerKeys.push(match);
  }

  return { dateKey, totalKey, registerKeys };
}

export interface ExtractedReadings {
  readings: MeterReading[];
  columns: DetectedColumns;
}

/** Pull cumulative readings out of a sheet's row objects for a single fuel. */
export function extractReadings(
  rows: Array<Record<string, unknown>>,
  fuel: Fuel,
  sourceFile: string,
): ExtractedReadings {
  const columns = detectColumns(rows);
  const readings: MeterReading[] = [];

  if (!columns.dateKey) return { readings, columns };

  for (const row of rows) {
    const date = formatExcelDate(row[columns.dateKey]);
    if (!date) continue;

    const registers = columns.registerKeys.map((key) => Number(row[key]) || 0);
    const summed = registers.reduce((total, value) => total + value, 0);
    const declaredTotal = columns.totalKey ? Number(row[columns.totalKey]) : NaN;
    const total = Number.isFinite(declaredTotal) ? declaredTotal : summed;

    if (!Number.isFinite(total)) continue;

    readings.push({
      date,
      fuel,
      register1: registers[0] ?? total,
      register2: registers[1] ?? 0,
      register3: registers[2] ?? 0,
      total,
      sourceFile,
    });
  }

  return { readings, columns };
}

export function mergeReadings(
  current: Record<string, MeterReading>,
  incoming: MeterReading[],
): Record<string, MeterReading> {
  const next = { ...current };
  for (const reading of incoming) {
    next[reading.date] = reading;
  }
  return next;
}

export function readingsSpanDays(readings: MeterReading[]): number | null {
  if (readings.length < 2) return null;
  const dates = readings.map((reading) => reading.date).sort();
  const first = new Date(`${dates[0]}T00:00:00Z`).getTime();
  const last = new Date(`${dates[dates.length - 1]}T00:00:00Z`).getTime();
  if (Number.isNaN(first) || Number.isNaN(last)) return null;
  return Math.round((last - first) / DAY_MS);
}

function byDate(a: MeterReading, b: MeterReading): number {
  return a.date.localeCompare(b.date);
}

/**
 * Build the day-by-day cost rows for the selected fuels. Electric usage is the
 * delta between consecutive register readings; gas usage is the delta between
 * consecutive totals, converted to kWh.
 */
export function computeDailyRows(
  readings: MeterReading[],
  tariff: EnergyTariff,
  selection: FuelSelection,
): DailyRow[] {
  const electric = selection.electric
    ? readings.filter((reading) => reading.fuel === 'electric').sort(byDate)
    : [];
  const gas = selection.gas
    ? readings.filter((reading) => reading.fuel === 'gas').sort(byDate)
    : [];

  const electricDaily = new Map<string, { r1: number; r2: number; r3: number }>();
  for (let i = 1; i < electric.length; i += 1) {
    const previous = electric[i - 1];
    const current = electric[i];
    electricDaily.set(current.date, {
      r1: Math.max(0, current.register1 - previous.register1),
      r2: tariff.electricRates.length >= 2 ? Math.max(0, current.register2 - previous.register2) : 0,
      r3: tariff.electricRates.length >= 3 ? Math.max(0, current.register3 - previous.register3) : 0,
    });
  }

  const gasDaily = new Map<string, { raw: number; kwh: number }>();
  for (let i = 1; i < gas.length; i += 1) {
    const previous = gas[i - 1];
    const current = gas[i];
    const raw = Math.max(0, current.total - previous.total);
    gasDaily.set(current.date, { raw, kwh: convertGasToKwh(raw, tariff.gasUnit) });
  }

  const dates = Array.from(new Set([...electricDaily.keys(), ...gasDaily.keys()])).sort();

  return dates.map((date) => {
    const electricDay = electricDaily.get(date);
    const gasDay = gasDaily.get(date);

    const elec1 = electricDay?.r1 ?? 0;
    const elec2 = electricDay?.r2 ?? 0;
    const elec3 = electricDay?.r3 ?? 0;
    const electricCost =
      (elec1 * (tariff.electricRates[0] ?? 0) +
        elec2 * (tariff.electricRates[1] ?? 0) +
        elec3 * (tariff.electricRates[2] ?? 0)) /
      100;

    const gasRaw = gasDay?.raw ?? 0;
    const gasKwh = gasDay?.kwh ?? 0;
    const gasCost = (gasKwh * tariff.gasRate) / 100;

    const standingCost =
      (electricDay ? tariff.electricStanding / 100 : 0) + (gasDay ? tariff.gasStanding / 100 : 0);

    return {
      date,
      elec1,
      elec2,
      elec3,
      electricCost,
      gasRaw,
      gasKwh,
      gasCost,
      standingCost,
      totalCost: electricCost + gasCost + standingCost,
    };
  });
}

export function summariseDailyRows(rows: DailyRow[], tariff: EnergyTariff): EnergySummary {
  const sum = (pick: (row: DailyRow) => number) => rows.reduce((total, row) => total + pick(row), 0);

  const elec1 = sum((row) => row.elec1);
  const elec2 = sum((row) => row.elec2);
  const elec3 = sum((row) => row.elec3);
  const electricKwh = elec1 + elec2 + elec3;
  const electricCost = sum((row) => row.electricCost);
  const electricStanding = sum((row) => (row.elec1 || row.elec2 || row.elec3 ? tariff.electricStanding / 100 : 0));
  const gasRaw = sum((row) => row.gasRaw);
  const gasKwh = sum((row) => row.gasKwh);
  const gasCost = sum((row) => row.gasCost);
  const gasStanding = sum((row) => (row.gasRaw > 0 ? tariff.gasStanding / 100 : 0));
  const totalCost = electricCost + electricStanding + gasCost + gasStanding;
  const days = rows.length;

  return {
    days,
    elec1,
    elec2,
    elec3,
    elec1Cost: (elec1 * (tariff.electricRates[0] ?? 0)) / 100,
    elec2Cost: (elec2 * (tariff.electricRates[1] ?? 0)) / 100,
    elec3Cost: (elec3 * (tariff.electricRates[2] ?? 0)) / 100,
    electricKwh,
    electricCost,
    electricStanding,
    gasRaw,
    gasKwh,
    gasCost,
    gasStanding,
    totalCost,
    dailyCost: days > 0 ? totalCost / days : 0,
    monthlyCost: days > 0 ? (totalCost / days) * AVG_DAYS_IN_MONTH : 0,
    yearlyCost: days > 0 ? (totalCost / days) * 365.25 : 0,
  };
}

function daysBetween(startDate: string, endDate: string): number | null {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / DAY_MS);
}

function numeric(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Manual (period) mode: a single summary, no day-by-day rows. */
export function computeManualSummary(input: ManualInput): EnergySummary | null {
  const days = daysBetween(input.startDate, input.endDate);
  if (days === null || days <= 0) return null;

  let elec1 = 0;
  let elec2 = 0;
  let elec3 = 0;

  if (input.selection.electric) {
    input.tiers.forEach((tier, index) => {
      let usage = 0;
      if (input.mode === 'readings') {
        const start = numeric(tier.start);
        const end = numeric(tier.end);
        usage = tier.start !== '' && tier.end !== '' && end >= start ? end - start : 0;
      } else {
        usage = numeric(tier.units);
      }
      if (index === 0) elec1 = usage;
      else if (index === 1) elec2 = usage;
      else if (index === 2) elec3 = usage;
    });
  }

  const rates = input.electricRates;
  const elec1Cost = (elec1 * (rates[0] ?? 0)) / 100;
  const elec2Cost = (elec2 * (rates[1] ?? 0)) / 100;
  const elec3Cost = (elec3 * (rates[2] ?? 0)) / 100;
  const electricKwh = elec1 + elec2 + elec3;
  const electricCost = elec1Cost + elec2Cost + elec3Cost;
  const electricStanding = input.selection.electric ? (input.electricStanding / 100) * days : 0;

  let gasRaw = 0;
  let gasKwh = 0;
  if (input.selection.gas) {
    if (input.mode === 'readings') {
      const start = numeric(input.gas.start);
      const end = numeric(input.gas.end);
      gasRaw = input.gas.start !== '' && input.gas.end !== '' && end >= start ? end - start : 0;
      gasKwh = convertGasToKwh(gasRaw, input.gas.unit);
    } else {
      gasKwh = numeric(input.gas.units);
      gasRaw = gasKwh;
    }
  }
  const gasCost = (gasKwh * input.gasRate) / 100;
  const gasStanding = input.selection.gas ? (input.gasStanding / 100) * days : 0;

  const totalCost = electricCost + electricStanding + gasCost + gasStanding;

  return {
    days,
    elec1,
    elec2,
    elec3,
    elec1Cost,
    elec2Cost,
    elec3Cost,
    electricKwh,
    electricCost,
    electricStanding,
    gasRaw,
    gasKwh,
    gasCost,
    gasStanding,
    totalCost,
    dailyCost: totalCost / days,
    monthlyCost: (totalCost / days) * AVG_DAYS_IN_MONTH,
    yearlyCost: (totalCost / days) * 365.25,
  };
}

export function dailyRowsToCsv(
  rows: DailyRow[],
  selection: FuelSelection,
  currency: Currency,
): string {
  const headers = [
    'Date',
    ...(selection.electric ? ['Elec kWh', `Elec Cost (${currency})`] : []),
    ...(selection.gas ? ['Gas Raw Units', 'Gas kWh', `Gas Cost (${currency})`] : []),
    `Standing Charges (${currency})`,
    `Day Total (${currency})`,
  ];

  const body = rows.map((row) => [
    row.date,
    ...(selection.electric
      ? [row.elec1 + row.elec2 + row.elec3, row.electricCost.toFixed(2)]
      : []),
    ...(selection.gas ? [row.gasRaw, row.gasKwh.toFixed(2), row.gasCost.toFixed(2)] : []),
    row.standingCost.toFixed(2),
    row.totalCost.toFixed(2),
  ]);

  return [headers.join(','), ...body.map((line) => line.join(','))].join('\n');
}
