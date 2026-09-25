import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateInitials(name: string): string {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/**
 * KPI types whose entries describe a rate or bounded score, so several entries
 * in a window must be averaged rather than totalled. `number` KPIs (ES Sales,
 * Smart Bookings, ...) are cumulative counts and stay summed.
 */
export function isAverageKpiType(type: string | null | undefined): boolean {
  return type === 'percentage' || type === 'scoreOutOf';
}
