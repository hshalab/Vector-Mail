import type { AurinkoCalendarEvent } from "./aurinko-calendar";

export const WORKING_HOURS = {
  startHour: 9,
  endHour: 18,
  workdays: new Set([1, 2, 3, 4, 5]),
  windowDays: 7,
} as const;

export interface BusyBlock {
  startISO: string;
  endISO: string;
  summary: string;
}

export interface FreeSlot {
  startISO: string;
  endISO: string;
  durationMinutes: number;
}

export interface DaySchedule {
  dateStr: string;
  label: string;
  isWorkday: boolean;
  allDayBlocked: boolean;
  busy: BusyBlock[];
  free: FreeSlot[];
}

export interface FreeBusyResult {
  timezone: string;
  fetchedAtISO: string;
  days: DaySchedule[];
}

function getTZOffsetMs(utcDate: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(utcDate);
  const get = (type: string): number => {
    const v = parts.find((p) => p.type === type)?.value ?? "0";
    return Number(v === "24" ? "0" : v);
  };
  const localAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return localAsUTC - utcDate.getTime();
}

function getUTCForLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTZOffsetMs(probe, tz);
  return new Date(probe.getTime() - offset);
}
function localDateStr(utcDate: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utcDate);
}

function localWeekday(utcDate: Date, tz: string): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(utcDate);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[s] ?? 0;
}

function dayLabel(utcDate: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(utcDate);
}

function parseDateStr(s: string): { year: number; month: number; day: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

interface Interval {
  start: number;
  end: number;
  summary: string;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]!;
    const cur = sorted[i]!;
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
      if (cur.summary && !last.summary.includes(cur.summary)) {
        last.summary = last.summary
          ? `${last.summary}, ${cur.summary}`
          : cur.summary;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}
export function computeFreeBusy(
  events: AurinkoCalendarEvent[],
  timezone: string,
): FreeBusyResult {
  const now = new Date();
  const days: DaySchedule[] = [];

  for (let i = 0; i < WORKING_HOURS.windowDays; i++) {
    const ref = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = localDateStr(ref, timezone);
    const { year, month, day } = parseDateStr(dateStr);
    const weekday = localWeekday(ref, timezone);
    const isWorkday = WORKING_HOURS.workdays.has(weekday);
    const workStart = getUTCForLocal(
      year,
      month,
      day,
      WORKING_HOURS.startHour,
      0,
      timezone,
    );
    const workEnd = getUTCForLocal(
      year,
      month,
      day,
      WORKING_HOURS.endHour,
      0,
      timezone,
    );

    const activeEvents = events.filter((ev) => {
      if (ev.status === "cancelled") return false;
      if (ev.transparency === "transparent") return false;

      if (ev.start.date) {
        return ev.start.date === dateStr;
      }
      if (!ev.start.dateTime) return false;

      const evStart = new Date(ev.start.dateTime).getTime();
      const evEnd = new Date(ev.end?.dateTime ?? ev.start.dateTime).getTime();

      return evEnd > workStart.getTime() && evStart < workEnd.getTime();
    });

    const allDayBlocked = activeEvents.some((ev) => !!ev.start.date);

    const rawIntervals: Interval[] = activeEvents
      .filter((ev) => !!ev.start.dateTime)
      .map((ev) => ({
        start: Math.max(
          new Date(ev.start.dateTime!).getTime(),
          workStart.getTime(),
        ),
        end: Math.min(
          new Date(ev.end?.dateTime ?? ev.start.dateTime!).getTime(),
          workEnd.getTime(),
        ),
        summary: ev.summary ?? "Event",
      }))
      .filter((b) => b.end > b.start);

    const merged = mergeIntervals(rawIntervals);

    const busy: BusyBlock[] = merged.map((b) => ({
      startISO: new Date(b.start).toISOString(),
      endISO: new Date(b.end).toISOString(),
      summary: b.summary,
    }));

    const free: FreeSlot[] = [];
    if (isWorkday && !allDayBlocked) {
      let cursor = workStart.getTime();
      for (const b of merged) {
        if (cursor < b.start) {
          const dur = Math.round((b.start - cursor) / 60_000);
          if (dur >= 15) {
            free.push({
              startISO: new Date(cursor).toISOString(),
              endISO: new Date(b.start).toISOString(),
              durationMinutes: dur,
            });
          }
        }
        cursor = Math.max(cursor, b.end);
      }
      if (cursor < workEnd.getTime()) {
        const dur = Math.round((workEnd.getTime() - cursor) / 60_000);
        if (dur >= 15) {
          free.push({
            startISO: new Date(cursor).toISOString(),
            endISO: workEnd.toISOString(),
            durationMinutes: dur,
          });
        }
      }
    }

    days.push({
      dateStr,
      label: dayLabel(ref, timezone),
      isWorkday,
      allDayBlocked,
      busy,
      free,
    });
  }

  return { timezone, fetchedAtISO: now.toISOString(), days };
}
