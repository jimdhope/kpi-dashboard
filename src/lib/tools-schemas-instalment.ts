import { z } from "zod";
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';

export const InstalmentPlanSchema = z.object({
  accountType: z.enum(['single', 'twoAccounts']).default('single'),
  accountNumber: z.string().optional().or(z.literal('')),
  currentBalance: z.union([z.coerce.number(), z.literal('')]).optional(),
  startDate: z.string().refine((date) => date && isValid(parseISO(date)), { message: "Please enter a valid start date."}),
  usageAmount: z.union([z.coerce.number(), z.literal('')]).optional(),
  instalmentAmount: z.union([z.coerce.number(), z.literal('')]).optional(),
  accountNumber2: z.string().optional().or(z.literal('')),
  currentBalance2: z.union([z.coerce.number(), z.literal('')]).optional(),
  startDate2: z.union([z.string().refine((date) => date && isValid(parseISO(date)), { message: "Please enter a valid start date for account 2."}), z.literal('')]).optional(),
  usageAmount2: z.union([z.coerce.number(), z.literal('')]).optional(),
  instalmentAmount2: z.union([z.coerce.number(), z.literal('')]).optional(),
}).superRefine((data, ctx) => {
  if (data.accountType === 'twoAccounts') {
    if (!data.accountNumber2 || data.accountNumber2 === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account 2 number is required.", path: ['accountNumber2'] });
    }
    if (!data.currentBalance2 && data.currentBalance2 !== 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account 2 balance is required.", path: ['currentBalance2'] });
    }
    if (!data.startDate2 || data.startDate2 === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account 2 start date is required.", path: ['startDate2'] });
    }
  }
});
export type InstalmentPlanFormValues = z.infer<typeof InstalmentPlanSchema>;
