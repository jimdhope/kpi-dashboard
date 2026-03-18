import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generates initials from a name string.
 * @param name - The full name string.
 * @returns The initials (e.g., "JD" for "Jane Doe").
 */
export function generateInitials(name: string): string {
  if (!name) return '';
  const names = name.trim().split(' ');
  if (names.length === 1) {
    return names[0].charAt(0).toUpperCase();
  }
  return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
}

/**
 * Generates a random HSL color string with fixed saturation and lightness for good contrast.
 * @returns A random HSL color string (e.g., "hsl(120, 50%, 70%)").
 */
export function generateRandomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 50; // Keep saturation consistent
  const lightness = 70; // Keep lightness consistent for readability
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
