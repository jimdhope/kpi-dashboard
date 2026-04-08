import { z } from "zod";
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';

export const InstalmentPlanSchema = z.object({
  currentBalance: z.union([z.coerce.number(), z.literal('')]).optional(),
  startDate: z.string().refine((date) => date && isValid(parseISO(date)), { message: "Please enter a valid start date."}),
  usageAmount: z.union([z.coerce.number(), z.literal('')]).optional(),
  instalmentAmount: z.union([z.coerce.number(), z.literal('')]).optional(),
});
export type InstalmentPlanFormValues = z.infer<typeof InstalmentPlanSchema>;

const SingleTariffSchema = z.object({
  name: z.union([z.string().min(1, { message: "Tariff name is required." }), z.literal('')]).optional(),
  electricityStandingCharge: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricityUnitRate1: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricityUnitRate2: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricityUnitRate3: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasStandingCharge: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasUnitRate: z.union([z.coerce.number(), z.literal('')]).optional(),
});

export const EnergyTariffComparisonSchema = z.object({
  usageData: z.object({
    electricityUsage1: z.union([z.coerce.number(), z.literal('')]).optional(),
    electricityUsage2: z.union([z.coerce.number(), z.literal('')]).optional(),
    electricityUsage3: z.union([z.coerce.number(), z.literal('')]).optional(),
    gasUsage: z.union([z.coerce.number(), z.literal('')]).optional(),
  }),
  tariffs: z.array(SingleTariffSchema).min(1, "At least one tariff is required for comparison.").optional(),
});

export type EnergyTariffComparisonFormValues = z.infer<typeof EnergyTariffComparisonSchema>;
export type SingleTariffFormValues = z.infer<typeof SingleTariffSchema>;

export const EnergyUsageSchema = z.object({
  startDate: z.union([z.string().refine((date) => date && isValid(parseISO(date)), { message: "Valid start date is required." }), z.literal('')]).optional(),
  endDate: z.union([z.string().refine((date) => date && isValid(parseISO(date)), { message: "Valid end date is required." }), z.literal('')]).optional(),
  
  inputMode: z.enum(["readings", "direct"]),

  electricStartReading1: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricEndReading1: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricStartReading2: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricEndReading2: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricStartReading3: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricEndReading3: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasStartReading: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasEndReading: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasUnitType: z.enum(["metric", "imperial"]).optional(),

  electricUnits1: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricUnits2: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricUnits3: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasUnits: z.union([z.coerce.number(), z.literal('')]).optional(),
  
  electricRate1: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricRate2: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricRate3: z.union([z.coerce.number(), z.literal('')]).optional(),
  electricStandingCharge: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasRate: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasStandingCharge: z.union([z.coerce.number(), z.literal('')]).optional(),

}).superRefine((data, ctx) => {
  if (data.startDate && data.endDate && isValid(parseISO(data.startDate)) && isValid(parseISO(data.endDate))) {
    const startDate = parseISO(data.startDate);
    const endDate = parseISO(data.endDate);
    if (endDate < startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date cannot be before start date.", path: ["endDate"] });
    }
    if (differenceInCalendarDays(endDate, startDate) < 0) { 
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Number of days must be non-negative.", path: ["endDate"] });
    }
  }

  const checkReadingOrder = (startReading: unknown, endReading: unknown, path: string, label: string) => {
    const start = typeof startReading === 'string' && startReading !== '' ? parseFloat(startReading) : typeof startReading === 'number' ? startReading : NaN;
    const end = typeof endReading === 'string' && endReading !== '' ? parseFloat(endReading) : typeof endReading === 'number' ? endReading : NaN;
    if (typeof start === 'number' && typeof end === 'number' && !isNaN(start) && !isNaN(end) && end < start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} end reading must be >= start reading.`, path: [path] });
    }
  };

  if (data.inputMode === "readings") {
    checkReadingOrder(data.electricStartReading1, data.electricEndReading1, "electricEndReading1", "Electricity Rate 1");
    checkReadingOrder(data.electricStartReading2, data.electricEndReading2, "electricEndReading2", "Electricity Rate 2");
    checkReadingOrder(data.electricStartReading3, data.electricEndReading3, "electricEndReading3", "Electricity Rate 3");
    checkReadingOrder(data.gasStartReading, data.gasEndReading, "gasEndReading", "Gas");
  }
});

export type EnergyUsageFormValues = z.infer<typeof EnergyUsageSchema>;

export const AgreedReadsSchema = z.object({
  startDate: z.union([z.string().refine(val => val && isValid(parseISO(val)), { message: "Valid start date is required." }), z.literal('')]).optional(),
  endDate: z.union([z.string().refine(val => val && isValid(parseISO(val)), { message: "Valid end date is required." }), z.literal('')]).optional(),
  proposedDate: z.union([z.string().refine(val => val && isValid(parseISO(val)), { message: "Valid proposed date is required." }), z.literal('')]).optional(),

  startReading1: z.union([z.coerce.number(), z.literal('')]).optional(),
  endReading1: z.union([z.coerce.number(), z.literal('')]).optional(),
  startReading2: z.union([z.coerce.number(), z.literal('')]).optional(),
  endReading2: z.union([z.coerce.number(), z.literal('')]).optional(),
  startReading3: z.union([z.coerce.number(), z.literal('')]).optional(),
  endReading3: z.union([z.coerce.number(), z.literal('')]).optional(),
  startReadingGas: z.union([z.coerce.number(), z.literal('')]).optional(),
  endReadingGas: z.union([z.coerce.number(), z.literal('')]).optional(),
}).superRefine((data, ctx) => {
  const { startDate: sDateStr, endDate: eDateStr, proposedDate: pDateStr } = data;

  if (sDateStr && !isValid(parseISO(sDateStr))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid start date.", path: ["startDate"] });
  if (eDateStr && !isValid(parseISO(eDateStr))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid end date.", path: ["endDate"] });
  if (pDateStr && !isValid(parseISO(pDateStr))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid proposed date.", path: ["proposedDate"] });
  
  if (sDateStr && eDateStr && isValid(parseISO(sDateStr)) && isValid(parseISO(eDateStr))) {
    const startDate = parseISO(sDateStr);
    const endDate = parseISO(eDateStr);
    if (endDate <= startDate) { 
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date must be after start date.", path: ["endDate"] });
    }
  }
  
  const checkReadingPairOrder = (startVal: unknown, endVal: unknown, rateName: string, endFieldPath: string) => {
    const startNum = typeof startVal === 'string' && startVal !== '' ? parseFloat(startVal) : typeof startVal === 'number' ? startVal : NaN;
    const endNum = typeof endVal === 'string' && endVal !== '' ? parseFloat(endVal) : typeof endVal === 'number' ? endVal : NaN;

    if (!isNaN(startNum) && !isNaN(endNum) && endNum < startNum) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `End reading for ${rateName} must be >= start reading.`, path: [endFieldPath] });
    }
  };

  checkReadingPairOrder(data.startReading1, data.endReading1, "Rate 1", "endReading1");
  checkReadingPairOrder(data.startReading2, data.endReading2, "Rate 2", "endReading2");
  checkReadingPairOrder(data.startReading3, data.endReading3, "Rate 3", "endReading3");
  checkReadingPairOrder(data.startReadingGas, data.endReadingGas, "Gas", "endReadingGas");
});

export type AgreedReadsFormValues = z.infer<typeof AgreedReadsSchema>;

const BurnsTestDayReadingsSchema = z.object({
  day1: z.union([z.coerce.number(), z.literal('')]).optional(),
  day2: z.union([z.coerce.number(), z.literal('')]).optional(),
  day3: z.union([z.coerce.number(), z.literal('')]).optional(),
  day4: z.union([z.coerce.number(), z.literal('')]).optional(),
  day5: z.union([z.coerce.number(), z.literal('')]).optional(),
  day6: z.union([z.coerce.number(), z.literal('')]).optional(),
  day7: z.union([z.coerce.number(), z.literal('')]).optional(),
});

export const BurnsTestSchema = z.object({
  electricityRate1Readings: BurnsTestDayReadingsSchema.optional(),
  electricityRate2Readings: BurnsTestDayReadingsSchema.optional(),
  electricityRate3Readings: BurnsTestDayReadingsSchema.optional(),
  gasReadings: BurnsTestDayReadingsSchema.optional(),
}).superRefine((data, ctx) => {
  const readingSets = [
    { readings: data.electricityRate1Readings, pathPrefix: "electricityRate1Readings", name: "Electricity Rate 1" },
    { readings: data.electricityRate2Readings, pathPrefix: "electricityRate2Readings", name: "Electricity Rate 2" },
    { readings: data.electricityRate3Readings, pathPrefix: "electricityRate3Readings", name: "Electricity Rate 3" },
    { readings: data.gasReadings, pathPrefix: "gasReadings", name: "Gas" },
  ];

  readingSets.forEach(set => {
    if (set.readings) {
      const days = ["day1", "day2", "day3", "day4", "day5", "day6", "day7"] as const;
      for (let i = 0; i < days.length - 1; i++) {
        const dayAVal = set.readings[days[i]];
        const dayBVal = set.readings[days[i+1]];
        
        const dayANum = typeof dayAVal === 'number' ? dayAVal : NaN;
        const dayBNum = typeof dayBVal === 'number' ? dayBVal : NaN;

        if (!isNaN(dayANum) && !isNaN(dayBNum) && dayBNum < dayANum) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${set.name} Day ${i + 2} reading cannot be less than Day ${i + 1} reading.`,
            path: [`${set.pathPrefix}.${days[i+1]}`],
          });
        }
      }
    }
  });
});

export type BurnsTestFormValues = z.infer<typeof BurnsTestSchema>;

export const DualFuelSchema = z.object({
  ongoingElecUsage: z.union([z.coerce.number(), z.literal('')]).optional(),
  elecBalance: z.union([z.coerce.number(), z.literal('')]).optional(),
  ongoingGasUsage: z.union([z.coerce.number(), z.literal('')]).optional(),
  gasBalance: z.union([z.coerce.number(), z.literal('')]).optional(),
});
export type DualFuelFormValues = z.infer<typeof DualFuelSchema>;
