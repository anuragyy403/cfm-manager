import { formatDistanceToNowStrict } from "date-fns";

/**
 * All dates are shown in the company's timezone so the server (often UTC in
 * production) and every browser render the same wall-clock times.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Kolkata";

const yearFmt = new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: APP_TIMEZONE });
const sameYear = (d: Date) => yearFmt.format(d) === yearFmt.format(new Date());

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIMEZONE,
});
const dateTimeYearFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: APP_TIMEZONE,
});
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const dateYearFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "12 Oct, 14:30" (adds the year when it isn't the current one). */
export function formatDateTime(date: Date | string) {
  const d = new Date(date);
  return (sameYear(d) ? dateTimeFmt : dateTimeYearFmt).format(d);
}

/** "12 Oct" (adds the year when it isn't the current one). */
export function formatDate(date: Date | string) {
  const d = new Date(date);
  return (sameYear(d) ? dateFmt : dateYearFmt).format(d);
}

/** "in 3 days" / "2 hours ago". */
export function formatRelative(date: Date | string) {
  return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
}

/** "18 h" under two days, otherwise "3.5 days". */
export function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  const hours = ms / 36e5;
  return hours < 48 ? `${Math.round(hours)} h` : `${(hours / 24).toFixed(1)} days`;
}

export function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}
