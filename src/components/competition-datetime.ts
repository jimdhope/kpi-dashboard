export function isoToDatetimeLocalValue(isoValue: string | null | undefined): string {
  if (!isoValue) return "";

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function datetimeLocalValueToIso(value: string): string | null {
  if (!value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}
