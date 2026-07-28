"use client";

import { api } from "@/trpc/react";
import { CalendarPlus } from "lucide-react";
import type { BookingCandidate } from "./BookingModal";
import { Skel } from "@/components/ui/skeletons";

interface Props {
  accountId: string;
  onThreadSelect?: (threadId: string) => void;
  onBookMeeting?: (candidate: BookingCandidate) => void;
}

function relativeDate(isoStr: string): string {
  const diffMs = Date.now() - new Date(isoStr).getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function MeetingRequestsWidget({
  accountId,
  onThreadSelect,
  onBookMeeting,
}: Props) {
  const { data, isLoading, isError } =
    api.account.getMeetingCandidates.useQuery(
      { accountId },
      { staleTime: 15 * 60 * 1000, retry: 1 },
    );

  return (
    <div className="calendar-widget">
      <div className="calendar-widget-head">
        <CalendarPlus className="calendar-widget-icon" />
        <span className="calendar-widget-title">MEETING REQUESTS</span>
        {data && data.candidates.length > 0 && (
          <span className="calendar-widget-count">
            {data.candidates.length}
          </span>
        )}
      </div>

      {isLoading && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "2px 0",
          }}
          aria-busy="true"
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", gap: 5 }}
            >
              <Skel
                delay={i * 70}
                className="rounded"
                style={{ height: 11, width: `${58 + i * 12}%` }}
              />
              <Skel
                delay={i * 70 + 35}
                className="rounded"
                style={{ height: 9, width: `${40 + i * 8}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--ink-4)",
            padding: "2px 0",
          }}
        >
          Could not scan inbox.
        </p>
      )}

      {!isLoading &&
        !isError &&
        data &&
        (data.candidates.length === 0 ? (
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "var(--ink-3)",
                lineHeight: 1.55,
              }}
            >
              No meeting requests in the last 14 days.
            </p>
            {data.scannedCount > 0 && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: "var(--ink-4)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                }}
              >
                {data.scannedCount} unanswered threads scanned
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {data.candidates.map((c) => (
              <button
                key={c.threadId}
                type="button"
                onClick={() =>
                  onBookMeeting
                    ? onBookMeeting({
                        threadId: c.threadId,
                        emailId: c.emailId,
                        sender: c.sender,
                        subject: c.subject,
                        snippet: c.snippet,
                        requestedConstraints: c.requestedConstraints,
                        intentType: c.intentType,
                        confidence: c.confidence,
                        latestMessageDateISO: c.latestMessageDateISO,
                      })
                    : onThreadSelect?.(c.threadId)
                }
                style={{
                  all: "unset",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  padding: "7px 8px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: "var(--bg-elev-2)",
                  border: "1px solid var(--line)",
                  width: "100%",
                  boxSizing: "border-box",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "var(--bg-elev-3, #e8ebf0)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "var(--bg-elev-2)")
                }
              >
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
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {c.sender.name ?? c.sender.address}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--ink-4)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    {relativeDate(c.latestMessageDateISO)}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--ink-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.subject}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ink-3)",
                    lineHeight: 1.45,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {c.snippet}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    flexWrap: "wrap",
                    marginTop: 1,
                  }}
                >
                  {onBookMeeting && onThreadSelect && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onThreadSelect(c.threadId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onThreadSelect(c.threadId);
                        }
                      }}
                      style={{
                        fontSize: 9,
                        color: "var(--ink-4)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                      }}
                    >
                      view email
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.09em",
                      textTransform: "uppercase",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      color:
                        c.intentType === "wants_to_schedule"
                          ? "var(--accent)"
                          : "var(--ink-3)",
                    }}
                  >
                    {c.intentType === "wants_to_schedule"
                      ? "wants to schedule"
                      : "shared calendar"}
                  </span>
                  {c.requestedConstraints && (
                    <span style={{ fontSize: 9.5, color: "var(--ink-3)" }}>
                      · {c.requestedConstraints}
                    </span>
                  )}
                </div>
              </button>
            ))}

            <p
              style={{
                margin: "2px 0 0",
                fontSize: 10,
                color: "var(--ink-4)",
                textAlign: "right",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              }}
            >
              {data.scannedCount} threads scanned
            </p>
          </div>
        ))}
    </div>
  );
}
