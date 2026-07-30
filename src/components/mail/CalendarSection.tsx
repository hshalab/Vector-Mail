"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { IconCalendar } from "./icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarConnectButton } from "./CalendarConnectButton";
import { CalendarFreeBusyPanel } from "./CalendarFreeBusyPanel";

interface CalendarSectionProps {
  accountId: string;
  calendarEnabled: boolean;
  emailAddress: string;
}

const CALENDAR_ERROR_MESSAGES: Record<
  string,
  { title: string; description: string }
> = {
  calendar_account_mismatch: {
    title: "Wrong Google account",
    description:
      "The calendar belongs to a different Google account than your connected Gmail. Connect with the same account.",
  },
  calendar_connect_cancelled: {
    title: "Calendar connection cancelled",
    description:
      "You closed the Google auth window. Click Connect calendar to try again.",
  },
  calendar_scope_calendar_missing: {
    title: "Calendar permission missing",
    description:
      "VectorMail needs calendar access. Try connecting again and approve the calendar permission.",
  },
  calendar_scope_mail_missing: {
    title: "Mail permission missing",
    description:
      "Something went wrong with OAuth scopes. Please try connecting again.",
  },
  calendar_token_failed: {
    title: "Calendar connection failed",
    description: "Could not complete the token exchange. Please try again.",
  },
  calendar_account_info_failed: {
    title: "Calendar connection failed",
    description: "Could not verify your Google identity. Please try again.",
  },
  calendar_connect_failed: {
    title: "Calendar connection failed",
    description: "An unexpected error occurred. Please try again.",
  },
  oauth_state: {
    title: "Security check failed",
    description:
      "The OAuth state token was invalid. This may be a CSRF attempt. Please try connecting again.",
  },
};

export function CalendarSection({
  accountId,
  calendarEnabled,
  emailAddress,
}: CalendarSectionProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("calendarConnected") === "1") {
      toast.success("Calendar connected", {
        id: "calendar-connected",
        description:
          "Your calendar is now linked. Free slots will appear when scheduling from your inbox.",
        duration: 5000,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("calendarConnected");
      window.history.replaceState({}, "", url.pathname + url.search);
    }

    const errorParam = searchParams.get("error");
    if (errorParam && errorParam in CALENDAR_ERROR_MESSAGES) {
      const msg = CALENDAR_ERROR_MESSAGES[errorParam]!;
      toast.error(msg.title, {
        id: "calendar-error",
        description: msg.description,
        duration: 8000,
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

  return (
    <div className="calendar-widget">
      <div className="calendar-widget-head">
        <span className="widget-chip">
          <IconCalendar />
        </span>
        <span className="calendar-widget-title">CALENDAR</span>
        {calendarEnabled && (
          <span
            className="calendar-widget-count"
            style={{ color: "var(--ink-2)", borderColor: "var(--line)" }}
          >
            on
          </span>
        )}
      </div>

      {calendarEnabled ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2
              style={{
                width: 12,
                height: 12,
                color: "var(--green)",
                flexShrink: 0,
              }}
            />
            <span
              style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
            >
              Connected
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-3)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {emailAddress}
          </span>
          <CalendarFreeBusyPanel accountId={accountId} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "var(--ink-3)",
              lineHeight: 1.55,
            }}
          >
            Connect your calendar to schedule from your inbox.
          </p>
          <CalendarConnectButton
            className={cn(
              "inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5",
              "text-[11px] font-semibold text-white shadow-sm transition-all",
              "bg-[#1e2a4a] hover:bg-[#0d1530] active:scale-[0.98]",
            )}
          />
        </div>
      )}
    </div>
  );
}
