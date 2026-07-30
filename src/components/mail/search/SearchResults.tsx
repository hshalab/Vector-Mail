"use client";
import React from "react";
import { formatDistanceToNow } from "date-fns";
import { useAtom } from "jotai";
import { SearchX } from "lucide-react";
import {
  searchResultsAtom,
  searchValueAtom,
  isSearchingAPIAtom,
  type SearchResult,
} from "./SearchBar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Skel } from "@/components/ui/skeletons";

function HighlightedSnippet({ html }: { html: string }) {
  return (
    <span
      className="[&_mark]:rounded-[3px] [&_mark]:bg-[var(--accent-soft)] [&_mark]:px-0.5 [&_mark]:font-medium [&_mark]:text-[var(--accent)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function SearchResults({
  onResultSelect,
}: {
  onResultSelect?: (threadId: string) => void;
}) {
  const [searchResults] = useAtom(searchResultsAtom);
  const [searchValue] = useAtom(searchValueAtom);
  const [isSearchingAPI] = useAtom(isSearchingAPIAtom);

  if (!searchValue.trim()) {
    return null;
  }

  const showLoading = searchValue.trim().length > 0 && isSearchingAPI;

  if (showLoading) {
    return (
      <div className="border-t border-[var(--line-soft)] bg-[var(--surface)]">
        <div className="p-4">
          <Skel className="mb-3 h-3.5 w-28 rounded" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex w-full items-start gap-2 rounded-[10px] border border-[var(--line-soft)] bg-[var(--surface-2)] p-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Skel delay={i * 60} className="h-3.5 w-24 rounded" />
                    <Skel delay={i * 60 + 20} className="h-3 w-12 rounded" />
                  </div>
                  <Skel delay={i * 60 + 40} className="h-3.5 w-[85%] rounded" />
                  <Skel delay={i * 60 + 60} className="h-3 w-[60%] rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (searchResults.length === 0) {
    return (
      <div className="border-t border-[var(--line-soft)] bg-[var(--surface)]">
        <div className="flex flex-col items-center gap-3.5 px-6 py-16 text-center">
          <span className="reader-empty-icon">
            <SearchX className="h-5 w-5" strokeWidth={1.5} />
          </span>
          <div>
            <p className="text-[14px] font-semibold tracking-[-0.015em] text-[var(--ink-1)]">
              Nothing matched &ldquo;{searchValue.trim()}&rdquo;
            </p>
            <p className="reader-empty-text mt-1.5">
              Search reads meaning, not just keywords — try describing the thread
              instead, like &ldquo;the invoice Sarah sent last week&rdquo;.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--line-soft)] bg-[var(--surface)]">
      <div className="p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-4)]">
          {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
        </div>
        <div className="space-y-2">
          {searchResults.map((result: SearchResult, index: number) => (
            <motion.button
              key={result.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onResultSelect?.(result.threadId)}
              className={cn(
                "w-full rounded-[10px] border border-[var(--line-soft)] bg-[var(--surface-2)] p-3 text-left transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-semibold tracking-[-0.012em] text-[var(--ink)]">
                      {result.from.name || result.from.address}
                    </span>
                    <span className="text-[11px] text-[var(--ink-4)]">
                      {formatDistanceToNow(new Date(result.sentAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {result.matchType === "keyword" ? (
                      <span className="tag" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
                        Keyword
                      </span>
                    ) : (
                      <span className="tag" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                        Meaning
                        {result.relevanceScorePercent != null && (
                          <span className="ml-1 opacity-75">
                            {result.relevanceScorePercent}%
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="mb-1 line-clamp-1 text-[13px] font-medium text-[var(--ink-1)]">
                    {result.subject}
                  </div>
                  {result.snippet && (
                    <div className="line-clamp-2 text-[12px] leading-relaxed text-[var(--ink-3)]">
                      {result.snippetHighlighted ? (
                        <HighlightedSnippet html={result.snippetHighlighted} />
                      ) : (
                        result.snippet
                      )}
                    </div>
                  )}
                  {(result.matchedKeywords?.length ?? 0) > 0 && (
                    <p className="mt-1.5 text-[11px] text-[var(--ink-4)]">
                      Matched &ldquo;{result.matchedKeywords!.slice(0, 5).join("\", \"")}&rdquo;
                    </p>
                  )}
                  {result.matchType === "keyword" &&
                    (result.matchedKeywords == null || result.matchedKeywords.length === 0) &&
                    result.snippet && (
                      <p className="mt-1.5 text-[11px] text-[var(--ink-4)]">
                        Keyword match
                      </p>
                    )}
                  {result.matchType === "semantic" && (
                    <p className="mt-1.5 text-[11px] text-[var(--ink-4)]">
                      Related to your search
                      {result.relevanceScorePercent != null
                        ? ` · ${result.relevanceScorePercent}% match`
                        : ""}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
