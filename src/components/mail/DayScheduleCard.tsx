"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { IconCalendar } from "./icons";

export type DayEvent = {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  meta?: string;
};

function clockTime(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h}${suffix}` : `${h}:${String(m).padStart(2, "0")}${suffix}`;
}

function duration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function countdown(mins: number): string {
  if (mins <= 0) return "Starting now";
  if (mins < 60) return `In ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `In ${h}h` : `In ${h}h ${m}m`;
}

export function DayScheduleCard({
  events,
  title = "Today",
}: {
  events: DayEvent[];
  title?: string;
}) {
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.startMin - b.startMin),
    [events],
  );

  const bookedMin = useMemo(() => {
    let booked = 0;
    let cursor = -1;
    for (const e of sorted) {
      const from = Math.max(e.startMin, cursor);
      if (e.endMin > from) {
        booked += e.endMin - from;
        cursor = e.endMin;
      }
    }
    return booked;
  }, [sorted]);

  const { visible, earlierCount, nextId } = useMemo(() => {
    if (nowMin === null) {
      return { visible: sorted, earlierCount: 0, nextId: sorted[0]?.id };
    }
    const ahead = sorted.filter((e) => e.endMin > nowMin);
    return {
      visible: ahead,
      earlierCount: sorted.length - ahead.length,
      nextId: ahead[0]?.id,
    };
  }, [sorted, nowMin]);

  const hasAny = events.length > 0;

  return (
    <div className="cal-card">
      <div className="cal-head">
        <span className="widget-chip">
          <IconCalendar />
        </span>
        <span className="cal-head-title">{title}</span>
        {hasAny && (
          <span
            className={cn("cal-badge", visible.length === 0 && "is-clear")}
          >
            {visible.length === 0
              ? "Clear"
              : `${visible.length} ${visible.length === 1 ? "meeting" : "meetings"}`}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="cal-empty">
          {hasAny
            ? `All ${events.length} meetings wrapped. The rest of the day is yours.`
            : "Nothing scheduled. Meetings we spot in your inbox land here."}
        </p>
      ) : (
        <ol className="cal-tl">
          {visible.map((e) => {
            const isNext = e.id === nextId;
            const isLive =
              nowMin !== null && e.startMin <= nowMin && e.endMin > nowMin;
            return (
              <li
                key={e.id}
                className={cn(
                  "cal-tl-item",
                  isNext && "is-next",
                  isLive && "is-live",
                )}
              >
                <span className="cal-tl-marker" aria-hidden />
                <div className="cal-tl-body">
                  <span className="cal-tl-when">
                    {isLive && nowMin !== null
                      ? `Now · ${e.endMin - nowMin} min left`
                      : isNext && nowMin !== null
                        ? countdown(e.startMin - nowMin)
                        : clockTime(e.startMin)}
                  </span>
                  <span className="cal-tl-title">{e.title}</span>
                  <span className="cal-tl-meta">
                    <span className="cal-tl-dur">
                      {duration(e.endMin - e.startMin)}
                    </span>
                    {e.meta && <span className="cal-tl-who">{e.meta}</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {hasAny && (
        <div className="cal-foot">
          <span>
            {earlierCount > 0
              ? `${earlierCount} earlier`
              : `${events.length} today`}
          </span>
          <span className="cal-foot-free">{duration(bookedMin)} booked</span>
        </div>
      )}
    </div>
  );
}

export default DayScheduleCard;
