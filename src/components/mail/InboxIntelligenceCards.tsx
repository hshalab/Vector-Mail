"use client";

import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";

type Props = {
  accountId: string;
  onRunQuery: (query: string) => void;
  className?: string;
};

export function InboxIntelligenceCards({
  accountId,
  onRunQuery,
  className,
}: Props) {
  const { data, isLoading } = api.account.getInboxIntelligenceCards.useQuery(
    { accountId },
    { enabled: !!accountId, staleTime: 60_000 },
  );

  if (!accountId || isLoading || !data?.cards?.length) return null;

  return (
    <div className={cn("border-b border-[var(--line-soft)] px-3 py-2.5", className)}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Opus-B.png"
          alt=""
          className="h-3.5 w-3.5 shrink-0 rounded-[3px] object-cover"
        />
        Inbox brain
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onRunQuery(c.suggestedQuery)}
            className="shrink-0 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-left transition hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]"
          >
            <div className="text-[11.5px] font-semibold tracking-[-0.01em] text-[var(--ink)]">
              {c.title}
            </div>
            <div className="mt-0.5 text-[10.5px] text-[var(--ink-4)]">
              {c.subtitle ?? `${c.count} in last 90 days · tap to search`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
