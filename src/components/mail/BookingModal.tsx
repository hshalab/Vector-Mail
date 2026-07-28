"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import {
  Loader2,
  X,
  Check,
  AlertTriangle,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { Skel } from "@/components/ui/skeletons";

export interface BookingCandidate {
  threadId: string;
  emailId: string;
  sender: { name: string | null; address: string };
  subject: string;
  snippet: string;
  requestedConstraints: string | null;
  intentType: string;
  confidence: number;
  latestMessageDateISO: string;
}

interface BusyBlockDisplay {
  startISO: string;
  endISO: string;
  summary: string;
}

interface DayScheduleDisplay {
  dateStr: string;
  label: string;
  busy: BusyBlockDisplay[];
}

interface SlotDisplay {
  startISO: string;
  endISO: string;
  label: string;
  draftReplyBody: string;
  daySchedule: DayScheduleDisplay;
}

const HOUR_PX = 28;
const DAY_START_H = 9;
const DAY_END_H = 18;
const TOTAL_HOURS = DAY_END_H - DAY_START_H;

function getLocalHoursMinutes(
  isoStr: string,
  tz: string,
): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(isoStr));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? DAY_START_H);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { h: h === 24 ? 0 : h, m };
}

function toYPx(isoStr: string, tz: string): number {
  const { h, m } = getLocalHoursMinutes(isoStr, tz);
  const minFromStart = (h - DAY_START_H) * 60 + m;
  return Math.max(0, minFromStart) * (HOUR_PX / 60);
}

function durationPx(startISO: string, endISO: string): number {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  return Math.max(14, (ms / 60_000) * (HOUR_PX / 60));
}

function MiniCalendar({
  slot,
  timezone,
}: {
  slot: SlotDisplay;
  timezone: string;
}) {
  const totalH = TOTAL_HOURS * HOUR_PX;

  return (
    <div style={{ display: "flex", gap: 6, userSelect: "none" }}>
      {/* Hour labels */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 34,
          flexShrink: 0,
        }}
      >
        {Array.from({ length: TOTAL_HOURS + 1 }).map((_, i) => {
          const h = DAY_START_H + i;
          const label = h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
          return (
            <div
              key={h}
              style={{
                height: i < TOTAL_HOURS ? HOUR_PX : 0,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-end",
                paddingRight: 4,
                paddingTop: 1,
                overflow: "visible",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "var(--ink-4)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          position: "relative",
          height: totalH,
          background: "var(--bg-elev-1)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: TOTAL_HOURS - 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: (i + 1) * HOUR_PX,
              left: 0,
              right: 0,
              height: 1,
              background: "var(--line)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          />
        ))}

        {slot.daySchedule.busy.map((b, i) => {
          const top = toYPx(b.startISO, timezone);
          const height = durationPx(b.startISO, b.endISO);
          if (top + height < 0 || top > totalH) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: Math.max(0, top),
                left: 0,
                right: 0,
                height: Math.min(height, totalH - Math.max(0, top)),
                background: "rgba(255,255,255,0.05)",
                borderLeft: "2px solid var(--ink-4)",
                display: "flex",
                alignItems: "center",
                padding: "0 6px",
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "var(--ink-3)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {b.summary}
              </span>
            </div>
          );
        })}

        {(() => {
          const top = toYPx(slot.startISO, timezone);
          const height = durationPx(slot.startISO, slot.endISO);
          return (
            <div
              style={{
                position: "absolute",
                top: Math.max(0, top),
                left: 0,
                right: 0,
                height: Math.min(height, totalH - Math.max(0, top)),
                background: "var(--accent, #1e2a4a)",
                borderLeft: "3px solid #5b8af5",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                overflow: "hidden",
                zIndex: 2,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {slot.label}
              </span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

type ModalStep =
  | { id: "loading" }
  | { id: "no_slots"; message: string }
  | { id: "error"; message: string }
  | {
      id: "pick_slot";
      slots: SlotDisplay[];
      timezone: string;
      threadSubject: string | null;
    }
  | {
      id: "confirm";
      slot: SlotDisplay;
      timezone: string;
      threadSubject: string | null;
    }
  | { id: "booking" }
  | { id: "success"; message: string }
  | { id: "partial_failure"; message: string }
  | {
      id: "booking_error";
      message: string;
      slot: SlotDisplay;
      timezone: string;
      threadSubject: string | null;
    };

interface Props {
  accountId: string;
  candidate: BookingCandidate;
  onClose: () => void;
}

export function BookingModal({ accountId, candidate, onClose }: Props) {
  const [step, setStep] = useState<ModalStep>({ id: "loading" });

  const lastConfirmRef = useRef<{
    slot: SlotDisplay;
    timezone: string;
    threadSubject: string | null;
  } | null>(null);
  const slotQuery = api.account.suggestMeetingSlots.useQuery(
    {
      accountId,
      threadId: candidate.threadId,
      requestedConstraints: candidate.requestedConstraints,
      durationMinutes: 30,
      senderName: candidate.sender.name,
      senderAddress: candidate.sender.address,
    },
    {
      enabled: true,
      retry: 0,
      staleTime: 5 * 60 * 1000,
    },
  );

  useEffect(() => {
    if (slotQuery.isError) {
      setStep({
        id: "error",
        message: slotQuery.error?.message ?? "Failed to load slots.",
      });
      return;
    }
    if (!slotQuery.data) return;
    const data = slotQuery.data;
    if (data.status === "no_slots") {
      setStep({ id: "no_slots", message: data.message });
    } else if (data.status === "ok" && data.slots.length > 0) {
      setStep({
        id: "pick_slot",
        slots: data.slots as SlotDisplay[],
        timezone: data.timezone,
        threadSubject: data.threadSubject,
      });
    } else {
      setStep({ id: "no_slots", message: "No available slots found." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotQuery.data, slotQuery.isError]);

  const bookMutation = api.account.bookMeeting.useMutation({
    onSuccess(data) {
      if (data.ok) {
        setStep({ id: "success", message: data.message });
      } else {
        setStep({ id: "partial_failure", message: data.message });
      }
    },
    onError(err) {
      const last = lastConfirmRef.current;
      setStep({
        id: "booking_error",
        message: (err as unknown as Error)?.message ?? "Booking failed.",
        slot: last?.slot ?? ({} as SlotDisplay),
        timezone: last?.timezone ?? "UTC",
        threadSubject: last?.threadSubject ?? null,
      });
    },
  });

  const handlePickSlot = useCallback(
    (slot: SlotDisplay, timezone: string, threadSubject: string | null) => {
      lastConfirmRef.current = { slot, timezone, threadSubject };
      setStep({ id: "confirm", slot, timezone, threadSubject });
    },
    [],
  );

  const handleApprove = useCallback(
    (slot: SlotDisplay, timezone: string) => {
      setStep({ id: "booking" });
      bookMutation.mutate({
        accountId,
        threadId: candidate.threadId,
        slot: {
          startISO: slot.startISO,
          endISO: slot.endISO,
          timezone,
          label: slot.label,
        },
        draftBody: slot.draftReplyBody,
        attendeeEmail: candidate.sender.address,
        attendeeName: candidate.sender.name,
      });
    },
    [accountId, bookMutation, candidate],
  );

  const senderLabel = candidate.sender.name ?? candidate.sender.address;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--bg-elev-2, #13161c)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "24px 24px 20px",
          width: "min(520px, 92vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "0.01em",
              }}
            >
              {step.id === "confirm" || step.id === "booking"
                ? "Confirm booking"
                : step.id === "success"
                  ? "Meeting booked"
                  : step.id === "partial_failure"
                    ? "Partially booked"
                    : "Schedule a call"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                marginTop: 2,
              }}
            >
              {senderLabel}
              {candidate.subject ? ` · ${candidate.subject}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              all: "unset",
              cursor: "pointer",
              color: "var(--ink-4)",
              padding: 4,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ height: 1, background: "var(--line)" }} />

        {step.id === "loading" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "12px 0",
            }}
            aria-busy="true"
            aria-label="Finding available times"
          >
            {[0, 1, 2].map((i) => (
              <Skel
                key={i}
                delay={i * 80}
                className="rounded-lg"
                style={{ height: 42, width: "100%" }}
              />
            ))}
          </div>
        )}

        {step.id === "no_slots" && (
          <div style={{ padding: "8px 0" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
              {step.message}
            </p>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              Close
            </button>
          </div>
        )}

        {(step.id === "error" || step.id === "booking_error") && (
          <div
            style={{
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                color: "var(--ink-2)",
                fontSize: 12,
              }}
            >
              <AlertTriangle
                style={{
                  width: 13,
                  height: 13,
                  flexShrink: 0,
                  marginTop: 1,
                  color: "#e88a2a",
                }}
              />
              {step.message}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {step.id === "booking_error" && step.slot.startISO && (
                <button
                  type="button"
                  onClick={() =>
                    setStep({
                      id: "confirm",
                      slot: step.slot,
                      timezone: step.timezone,
                      threadSubject: step.threadSubject,
                    })
                  }
                  style={primaryBtnStyle}
                >
                  Try again
                </button>
              )}
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {step.id === "pick_slot" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--ink-3)",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Available times · {step.timezone}
            </p>
            {step.slots.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() =>
                  handlePickSlot(s, step.timezone, step.threadSubject)
                }
                style={{
                  all: "unset",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "var(--bg-elev-1)",
                  border: "1px solid var(--line)",
                  transition: "border-color 0.12s, background 0.12s",
                  gap: 8,
                  boxSizing: "border-box",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--line)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar
                    style={{
                      width: 13,
                      height: 13,
                      color: "var(--ink-3)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                <ChevronRight
                  style={{
                    width: 13,
                    height: 13,
                    color: "var(--ink-4)",
                    flexShrink: 0,
                  }}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              style={{ ...secondaryBtnStyle, marginTop: 4 }}
            >
              Cancel
            </button>
          </div>
        )}
        {step.id === "confirm" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Mini calendar */}
            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                {step.slot.daySchedule.label} · {step.timezone}
              </p>
              <MiniCalendar slot={step.slot} timezone={step.timezone} />
            </div>

            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Draft reply
              </p>
              <div
                style={{
                  background: "var(--bg-elev-1)",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                    To:{" "}
                  </span>
                  {senderLabel}{" "}
                  <span style={{ color: "var(--ink-4)" }}>
                    &lt;{candidate.sender.address}&gt;
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                    Subject:{" "}
                  </span>
                  {step.threadSubject
                    ? /^re:\s/i.test(step.threadSubject)
                      ? step.threadSubject
                      : `Re: ${step.threadSubject}`
                    : "Re: (your email)"}
                </div>
                <div
                  style={{
                    height: 1,
                    background: "var(--line)",
                    marginTop: 2,
                    marginBottom: 2,
                  }}
                />
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "var(--ink-2)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                  }}
                >
                  {step.slot.draftReplyBody}
                </pre>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => handleApprove(step.slot, step.timezone)}
                style={primaryBtnStyle}
              >
                Approve - book &amp; send
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = slotQuery.data;
                  setStep({
                    id: "pick_slot",
                    slots: d?.status === "ok" ? (d.slots as SlotDisplay[]) : [],
                    timezone: step.timezone,
                    threadSubject: step.threadSubject,
                  });
                }}
                style={secondaryBtnStyle}
              >
                Back
              </button>
              <button type="button" onClick={onClose} style={secondaryBtnStyle}>
                Dismiss
              </button>
            </div>

            <p
              style={{
                margin: "0",
                fontSize: 10,
                color: "var(--ink-4)",
                lineHeight: 1.5,
              }}
            >
              Clicking Approve will create the calendar event AND send this
              reply. Nothing fires until you click Approve.
            </p>
          </div>
        )}
        {step.id === "booking" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 0",
              color: "var(--ink-3)",
              fontSize: 12,
            }}
          >
            <Loader2
              style={{ width: 14, height: 14 }}
              className="animate-spin"
            />
            Booking meeting…
          </div>
        )}
        {step.id === "success" && (
          <div
            style={{
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--ink)",
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "var(--green, #1e7d3a)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check style={{ width: 12, height: 12, color: "#fff" }} />
              </div>
              <span style={{ fontWeight: 600 }}>{step.message}</span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--ink-3)",
                lineHeight: 1.5,
              }}
            >
              The calendar event has been created and your reply has been sent
              in the thread.
            </p>
            <button type="button" onClick={onClose} style={primaryBtnStyle}>
              Done
            </button>
          </div>
        )}
        {step.id === "partial_failure" && (
          <div
            style={{
              padding: "8px 0",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <AlertTriangle
                style={{
                  width: 14,
                  height: 14,
                  flexShrink: 0,
                  marginTop: 1,
                  color: "#e88a2a",
                }}
              />
              <div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#e88a2a",
                  }}
                >
                  Calendar booked - reply failed
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    color: "var(--ink-3)",
                    lineHeight: 1.55,
                  }}
                >
                  {step.message}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} style={primaryBtnStyle}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  all: "unset" as const,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 16px",
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  background: "var(--accent, #1e2a4a)",
  color: "#fff",
  border: "1px solid transparent",
  transition: "opacity 0.12s",
  flexShrink: 0,
};

const secondaryBtnStyle: React.CSSProperties = {
  all: "unset" as const,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 7,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
  background: "transparent",
  color: "var(--ink-3)",
  border: "1px solid var(--line)",
  transition: "border-color 0.12s",
  flexShrink: 0,
};
