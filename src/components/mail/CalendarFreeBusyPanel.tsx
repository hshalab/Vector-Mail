"use client";

import { api } from "@/trpc/react";
import { CalendarX } from "lucide-react";
import type { DaySchedule } from "@/lib/calendar-freebusy";
import { Skel } from "@/components/ui/skeletons";

interface Props {
  accountId: string;
}

function formatTime(isoStr: string, tz: string): string {
  const d = new Date(isoStr);
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return s
    .replace(/:00([\s ]?[AP]M)$/i, "$1")
    .replace(/[\s ]+/g, "")
    .toLowerCase();
}

function formatDur(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function DayRow({ day, tz }: { day: DaySchedule; tz: string }) {
  const totalFreeMin = day.free.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: day.isWorkday ? "var(--ink)" : "var(--ink-4)",
            whiteSpace: "nowrap",
          }}
        >
          {day.label}
        </span>
        <span
          style={{
            fontSize: 10,
            color: day.allDayBlocked
              ? "var(--ink-4)"
              : !day.isWorkday
                ? "var(--ink-4)"
                : totalFreeMin > 0
                  ? "var(--ink-3)"
                  : "var(--ink-4)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {day.allDayBlocked
            ? "all day"
            : !day.isWorkday
              ? "weekend"
              : totalFreeMin > 0
                ? `${formatDur(totalFreeMin)} free`
                : "booked"}
        </span>
      </div>

      {day.isWorkday && !day.allDayBlocked && day.busy.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            paddingLeft: 8,
          }}
        >
          {day.busy.map((b, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: "50%",
                  background: "var(--ink-3)",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--ink-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {formatTime(b.startISO, tz)}-{formatTime(b.endISO, tz)}{" "}
                <span style={{ color: "var(--ink-3)" }}>{b.summary}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {day.isWorkday && !day.allDayBlocked && day.free.length > 0 && (
        <div style={{ paddingLeft: 8 }}>
          <span
            style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.5 }}
          >
            Free:{" "}
            {day.free.map((s, i) => (
              <span key={i}>
                {i > 0 && ", "}
                {formatTime(s.startISO, tz)}-{formatTime(s.endISO, tz)}
              </span>
            ))}
          </span>
        </div>
      )}

      {day.isWorkday && !day.allDayBlocked && day.busy.length === 0 && (
        <div style={{ paddingLeft: 8 }}>
          <span style={{ fontSize: 10, color: "var(--ink-3)" }}>
            Clear 9am-6pm
          </span>
        </div>
      )}
    </div>
  );
}

export function CalendarFreeBusyPanel({ accountId }: Props) {
  const { data, isLoading, isError } = api.account.getCalendarFreeBusy.useQuery(
    { accountId },
    {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  );

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "2px 0 4px",
        }}
        aria-busy="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            <Skel
              delay={i * 60}
              className="rounded"
              style={{ width: 46, height: 10, flexShrink: 0 }}
            />
            <Skel
              delay={i * 60 + 30}
              className="rounded"
              style={{ height: 10, flex: 1, maxWidth: 132 }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data || data.status === "error") {
    const msg =
      data?.status === "error" ? data.message : "Could not load schedule";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 0 4px",
        }}
      >
        <CalendarX
          style={{
            width: 11,
            height: 11,
            color: "var(--ink-4)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{msg}</span>
      </div>
    );
  }

  if (data.status === "not_connected") return null;

  const { days, timezone, rawEventsFetched } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          paddingBottom: 6,
          borderTop: "1px solid var(--line)",
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "var(--ink-3)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          NEXT 7 DAYS
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--ink-4)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}
        >
          {typeof rawEventsFetched === "number"
            ? `${rawEventsFetched}ev · `
            : ""}
          {timezone.replace(/_/g, " ")}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map((day) => (
          <DayRow key={day.dateStr} day={day} tz={timezone} />
        ))}
      </div>
    </div>
  );
}
