"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { IconAperture } from "@/components/mail/icons";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";
import { Skel, SkeletonLines } from "@/components/ui/skeletons";
import { trackInboxBrainEvent } from "@/lib/analytics/inbox-brain";
import { useIsMobile } from "@/hooks/use-mobile";

export function ThreadBrainPanel({
  threadId,
  accountId,
}: {
  threadId: string;
  accountId: string;
}) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isMobile) setExpanded(true);
    else setExpanded(false);
  }, [threadId, isMobile]);

  const queryEnabled = Boolean(threadId && accountId && expanded);

  const { data, isLoading, isError, error } =
    api.account.getThreadBrain.useQuery(
      { threadId, accountId },
      {
        enabled: queryEnabled,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
    );

  const toggleMobile = () =>
    setExpanded((e) => {
      const next = !e;
      trackInboxBrainEvent("thread_brain_expanded", {
        expanded: next,
        surface: "mobile",
      });
      return next;
    });

  return (
    <div className="ai-brief">
      {isMobile ? (
        <button
          type="button"
          onClick={toggleMobile}
          aria-expanded={expanded}
          className="ai-brief-head -mx-1.5 -my-1 w-[calc(100%+0.75rem)] cursor-pointer rounded-md px-1.5 py-1 text-left transition-colors active:bg-[var(--surface-3)] [touch-action:manipulation]"
        >
          <span className="ai-brief-icon">
            <IconAperture />
          </span>
          <span className="ai-brief-label">Inbox brain</span>
          <span className="ai-brief-live">Live</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[var(--ink-3)] transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="ai-brief-head">
          <span className="ai-brief-icon">
            <IconAperture />
          </span>
          <span className="ai-brief-label">Inbox brain</span>
          <span className="ai-brief-live">Live</span>
        </div>
      )}

      {expanded && (
        <div className="ai-brief-body">
          {isLoading && (
            <div
              className="flex flex-col gap-3.5"
              aria-busy="true"
              aria-label="Reading thread"
            >
              <div className="flex flex-col gap-1.5">
                <Skel className="h-2.5 w-28 rounded-sm" />
                <SkeletonLines lines={2} lastWidth="68%" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skel className="h-2.5 w-36 rounded-sm" delay={90} />
                <SkeletonLines lines={2} lastWidth="52%" />
              </div>
            </div>
          )}
          {isError && (
            <p className="ai-brief-error">
              {error?.message ?? "Couldn’t load inbox brain."}
            </p>
          )}
          {!isLoading && !isError && data && (
            <>
              <p className="ai-brief-summary">{data.about}</p>

              <div className="ai-brief-action">
                <div className="ai-brief-action-head">
                  <span className="ai-brief-action-label">Your move</span>
                  <span
                    className={cn(
                      "ai-brief-priority",
                      `ai-brief-priority-${data.expectedPriority.toLowerCase()}`,
                    )}
                    title="How urgently this needs your reply"
                  >
                    {data.expectedPriority}
                  </span>
                </div>
                <p className="ai-brief-action-body">{data.expectedFromMe}</p>
                {data.expectedReason && (
                  <p className="ai-brief-why">
                    <span className="ai-brief-why-label">Why</span>
                    {data.expectedReason}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
