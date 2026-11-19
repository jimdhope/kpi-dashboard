import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVG_DAYS_IN_MONTH,
  CALORIFIC_VALUE,
  IMPERIAL_FT3_TO_M3_FACTOR,
  KWH_CONVERSION_DIVISOR,
  VOLUME_CORRECTION_FACTOR,
  computeDailyRows,
  computeManualSummary,
  convertGasToKwh,
  dailyRowsToCsv,
  detectColumns,
  extractReadings,
  formatExcelDate,
  mergeReadings,
  readingsSpanDays,
  summariseDailyRows,
  type EnergyTariff,
  type FuelSelection,
  type ManualInputMode,
  type MeterReading,
} from './energy';

const SAMPLE: Array<{ date: string; reading: number }> = [
  { date: '2026-10-20', reading: 44498 },
  { date: '2026-10-21', reading: 44506 },
  { date: '2026-10-22', reading: 44514 },
  { date: '2026-10-23', reading: 44529 },
  { date: '2026-10-24', reading: 44536 },
  { date: '2026-10-25', reading: 44542 },
  { date: '2026-10-26', reading: 44576 },
  { date: '2026-10-27', reading: 44587 },
  { date: '2026-10-28', reading: 44596 },
  { date: '2026-10-29', reading: 44609 },
  { date: '2026-10-30', reading: 44614 },
  { date: '2026-10-31', reading: 44620 },
  { date: '2026-11-01', reading: 44625 },
  { date: '2026-11-02', reading: 44654 },
  { date: '2026-11-03', reading: 44669 },
  { date: '2026-11-04', reading: 44682 },
  { date: '2026-11-05', reading: 44690 },
  { date: '2026-11-06', reading: 44707 },
  { date: '2026-11-07', reading: 44715 },
  { date: '2026-11-08', reading: 44729 },
  { date: '2026-11-09', reading: 44759 },
  { date: '2026-11-10', reading: 44768 },
  { date: '2026-11-11', reading: 44775 },
  { date: '2026-11-12', reading: 44781 },
  { date: '2026-11-13', reading: 44797 },
  { date: '2026-11-14', reading: 44815 },
  { date: '2026-11-15', reading: 44822 },
  { date: '2026-11-16', reading: 44828 },
  { date: '2026-11-17', reading: 44834 },
  { date: '2026-11-18', reading: 44863 },
  { date: '2026-11-19', reading: 44870 },
];

const electricReadings: MeterReading[] = SAMPLE.map((row) => ({
  date: row.date,
  fuel: 'electric',
  register1: row.reading,
  register2: 0,
  register3: 0,
  total: row.reading,
  sourceFile: 'EXPORT.xlsx',
}));

function tariff(overrides: Partial<EnergyTariff> = {}): EnergyTariff {
  return {
    electricRates: [24.5],
    electricStanding: 60.99,
    gasRate: 6.24,
    gasStanding: 31.65,
    gasUnit: 'metric',
    ...overrides,
  };
}

test('formatExcelDate handles serial numbers, ISO, UK dates and Date objects', () => {
  const serial = (Date.UTC(2026, 9, 20) - Date.UTC(1899, 11, 30)) / 86_400_000;
  assert.equal(formatExcelDate(serial), '2026-10-20');
  assert.equal(formatExcelDate('2026-10-20'), '2026-10-20');
  assert.equal(formatExcelDate('20/10/2026'), '2026-10-20');
  assert.equal(formatExcelDate(new Date(Date.UTC(2026, 9, 20))), '2026-10-20');
  assert.equal(formatExcelDate('not a date'), null);
  assert.equal(formatExcelDate(undefined), null);
});

test('detectColumns matches date, total and register headers', () => {
  const rows = [
    { 'Date & Time': '2026-10-20', Total: 44498, 'Register 1': 44498, 'Register 2': 100 },
  ];
  const columns = detectColumns(rows);
  assert.equal(columns.dateKey, 'Date & Time');
  assert.equal(columns.totalKey, 'Total');
  assert.deepEqual(columns.registerKeys, ['Register 1', 'Register 2']);
});

test('detectColumns falls back when only a total column is present', () => {
  const columns = detectColumns([{ 'Reading Date': '2026-10-20', Total: 10 }]);
  assert.equal(columns.dateKey, 'Reading Date');
  assert.equal(columns.totalKey, 'Total');
  assert.deepEqual(columns.registerKeys, []);
});

test('extractReadings reads electric registers and gas totals', () => {
  const electric = extractReadings(
    [
      { 'Date & Time': '2026-10-20', 'Register 1': 44498, 'Register 2': 100 },
      { 'Date & Time': '2026-10-21', 'Register 1': 44506, 'Register 2': 104 },
    ],
    'electric',
    'elec.xlsx',
  );
  assert.equal(electric.readings.length, 2);
  assert.equal(electric.readings[0].register1, 44498);
  assert.equal(electric.readings[0].register2, 100);
  assert.equal(electric.readings[0].total, 44598);

  const gas = extractReadings([{ 'Date & Time': '2026-10-20', Total: 1000 }], 'gas', 'gas.xlsx');
  assert.equal(gas.readings[0].fuel, 'gas');
  assert.equal(gas.readings[0].total, 1000);
  assert.equal(gas.readings[0].register1, 1000);
});

test('extractReadings sums registers when no total column exists', () => {
  const { readings } = extractReadings(
    [{ 'Date & Time': '2026-10-20', 'Register 1': 10, 'Register 2': 5 }],
    'electric',
    'e.xlsx',
  );
  assert.equal(readings[0].total, 15);
});

test('convertGasToKwh supports metric, imperial and raw kWh', () => {
  assert.equal(convertGasToKwh(0, 'metric'), 0);
  const metric = (10 * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE) / KWH_CONVERSION_DIVISOR;
  const imperial = (10 * IMPERIAL_FT3_TO_M3_FACTOR * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE) / KWH_CONVERSION_DIVISOR;
  assert.ok(Math.abs(convertGasToKwh(10, 'metric') - metric) < 1e-9);
  assert.ok(Math.abs(convertGasToKwh(10, 'imperial') - imperial) < 1e-9);
  assert.equal(convertGasToKwh(10, 'kwh'), 10);
});

test('computeDailyRows derives electric tiers and gas deltas', () => {
  const readings: MeterReading[] = [
    { date: '2026-10-20', fuel: 'electric', register1: 44498, register2: 100, register3: 0, total: 44598, sourceFile: 'e' },
    { date: '2026-10-21', fuel: 'electric', register1: 44506, register2: 104, register3: 0, total: 44610, sourceFile: 'e' },
    { date: '2026-10-20', fuel: 'gas', register1: 1000, register2: 0, register3: 0, total: 1000, sourceFile: 'g' },
    { date: '2026-10-21', fuel: 'gas', register1: 1010, register2: 0, register3: 0, total: 1010, sourceFile: 'g' },
  ];

  const rows = computeDailyRows(
    readings,
    tariff({ electricRates: [24.5, 14.2] }),
    { electric: true, gas: true },
  );

  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.date, '2026-10-21');
  assert.equal(row.elec1, 8);
  assert.equal(row.elec2, 4);
  assert.ok(Math.abs(row.electricCost - 2.528) < 1e-9);
  assert.equal(row.gasRaw, 10);
  assert.ok(Math.abs(row.gasKwh - 113.6266666667) < 1e-9);
  assert.ok(Math.abs(row.gasCost - 7.090304) < 1e-9);
  assert.ok(Math.abs(row.standingCost - 0.9264) < 1e-9);
});

test('computeDailyRows ignores registers beyond the selected rate count', () => {
  const readings: MeterReading[] = [
    { date: '2026-10-20', fuel: 'electric', register1: 100, register2: 10, register3: 5, total: 115, sourceFile: 'e' },
    { date: '2026-10-21', fuel: 'electric', register1: 110, register2: 20, register3: 9, total: 139, sourceFile: 'e' },
  ];
  const rows = computeDailyRows(readings, tariff({ electricRates: [24.5] }), { electric: true, gas: false });
  assert.equal(rows[0].elec1, 10);
  assert.equal(rows[0].elec2, 0);
  assert.equal(rows[0].elec3, 0);
});

test('summariseDailyRows totals the sample month', () => {
  const rows = computeDailyRows(electricReadings, tariff(), { electric: true, gas: false });
  const summary = summariseDailyRows(rows, tariff());

  assert.equal(summary.days, 30);
  assert.equal(summary.elec1, 372);
  assert.ok(Math.abs(summary.electricCost - 91.14) < 1e-9);
  assert.ok(Math.abs(summary.electricStanding - 18.297) < 1e-9);
  assert.ok(Math.abs(summary.totalCost - 109.437) < 1e-9);
  assert.ok(Math.abs(summary.dailyCost - 109.437 / 30) < 1e-9);
  assert.ok(Math.abs(summary.monthlyCost - (109.437 / 30) * AVG_DAYS_IN_MONTH) < 1e-9);
});

test('computeManualSummary handles readings mode for both fuels', () => {
  const summary = computeManualSummary({
    startDate: '2026-10-20',
    endDate: '2026-11-19',
    mode: 'readings',
    tiers: [
      { start: '44498', end: '44870', units: '' },
      { start: '', end: '', units: '' },
      { start: '', end: '', units: '' },
    ],
    electricRates: [24.5],
    electricStanding: 60.99,
    gas: { start: '1000', end: '1010', units: '', unit: 'metric' },
    gasRate: 6.24,
    gasStanding: 31.65,
    selection: { electric: true, gas: true },
  });

  assert.ok(summary);
  assert.equal(summary.days, 30);
  assert.equal(summary.elec1, 372);
  assert.equal(summary.gasRaw, 10);
  assert.ok(Math.abs(summary.gasKwh - 113.6266666667) < 1e-9);
  assert.ok(Math.abs(summary.totalCost - (91.14 + 18.297 + 7.090304 + 9.495)) < 1e-9);
});

test('computeManualSummary handles direct units and rejects invalid ranges', () => {
  const summary = computeManualSummary({
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    mode: 'direct',
    tiers: [{ start: '', end: '', units: '100' }, { start: '', end: '', units: '' }, { start: '', end: '', units: '' }],
    electricRates: [24.5],
    electricStanding: 0,
    gas: { start: '', end: '', units: '50', unit: 'kwh' },
    gasRate: 6.24,
    gasStanding: 0,
    selection: { electric: true, gas: true },
  });
  assert.ok(summary);
  assert.equal(summary.days, 29);
  assert.equal(summary.elec1, 100);
  assert.equal(summary.gasKwh, 50);

  const invalid = computeManualSummary({
    startDate: '2026-11-30',
    endDate: '2026-11-01',
    mode: 'direct',
    tiers: [{ start: '', end: '', units: '1' }, { start: '', end: '', units: '' }, { start: '', end: '', units: '' }],
    electricRates: [24.5],
    electricStanding: 0,
    gas: { start: '', end: '', units: '', unit: 'metric' },
    gasRate: 0,
    gasStanding: 0,
    selection: { electric: true, gas: false },
  });
  assert.equal(invalid, null);
});

test('mergeReadings de-duplicates by date with the latest file winning', () => {
  const merged = mergeReadings(
    { '2026-10-20': { date: '2026-10-20', fuel: 'electric', register1: 1, register2: 0, register3: 0, total: 1, sourceFile: 'a' } },
    [{ date: '2026-10-20', fuel: 'electric', register1: 2, register2: 0, register3: 0, total: 2, sourceFile: 'b' }],
  );
  assert.equal(merged['2026-10-20'].total, 2);
  assert.equal(merged['2026-10-20'].sourceFile, 'b');
});

test('readingsSpanDays measures the covered range', () => {
  assert.equal(readingsSpanDays(electricReadings), 30);
  assert.equal(readingsSpanDays(electricReadings.slice(0, 1)), null);
});

test('dailyRowsToCsv includes fuel columns and totals', () => {
  const rows = computeDailyRows(electricReadings.slice(0, 3), tariff(), { electric: true, gas: false });
  const csv = dailyRowsToCsv(rows, { electric: true, gas: false }, '£');
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Date,Elec kWh,Elec Cost (£),Standing Charges (£),Day Total (£)');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '2026-10-21,8,1.96,0.61,2.57');
});
