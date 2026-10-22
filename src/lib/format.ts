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

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: APP_TIMEZONE });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIMEZONE });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: APP_TIMEZONE });
const calendarDayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "14:30". */
export function formatTime(date: Date | string) {
  return timeFmt.format(new Date(date));
}

/** "2026-10-22" in the company's timezone, for grouping by day. */
export function dayKey(date: Date | string) {
  return dayKeyFmt.format(new Date(date));
}

/** "Today", "Yesterday" or "Wednesday 22 October", for a divider in a conversation. */
export function formatDayDivider(date: Date | string) {
  const key = dayKey(date);
  if (key === dayKey(new Date())) return "Today";
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return weekdayFmt.format(new Date(date));
}

/** A calendar date stored without a time (e.g. a meeting date): "Wed, 22 Oct 2026". */
export function formatCalendarDate(date: Date | string) {
  return calendarDayFmt.format(new Date(date));
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
