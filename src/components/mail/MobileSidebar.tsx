"use client";

import Link from "next/link";
import {
  Bot,
  Search,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./AccountSwitcher";

interface MobileSidebarProps {
  navItems: Array<{
    id: string;
    icon: React.ElementType;
    label: string;
  }>;
  tab: string;
  setTab: (tab: string) => void;
  router: ReturnType<typeof useRouter>;
  onNavigate?: (newTab: string, isBuddy?: boolean) => void;
}

export function MobileSidebar({
  navItems,
  tab,
  setTab,
  onNavigate,
}: MobileSidebarProps) {
  return (
    <div className="relative flex h-full flex-col bg-white dark:bg-[var(--surface)]">
      <Link
        href="/"
        prefetch
        className="flex w-full items-center gap-3 border-b border-[var(--line)] p-4 transition-opacity hover:opacity-90 active:opacity-95 dark:border-[var(--line)]"
      >
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[var(--accent)] dark:bg-[var(--accent)]">
          <video
            src="/Vectormail-logo.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full scale-[1.6] object-cover"
          />
        </div>
        <div>
          <h2 className="text-[15px] font-medium text-[var(--ink)] dark:text-[var(--ink)]">VectorMail</h2>
          <p
            className="mt-0.5 text-[12px] text-[var(--ink-2)] dark:text-[var(--ink-3)]"
            style={{
              fontFamily: "var(--font-newsreader), Georgia, serif",
              fontStyle: "italic",
              letterSpacing: "-0.005em",
            }}
          >
            The inbox, rewritten.
          </p>
        </div>
      </Link>

      <div className="border-[var(--line)] dark:border-[var(--line)] md:border-b md:p-3">
        <div className="hidden md:block">
          <AccountSwitcher isCollapsed={false} />
        </div>
      </div>

      <div className="space-y-0.5 p-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (onNavigate && tab !== item.id) {
                onNavigate(item.id, false);
              } else {
                setTab(item.id);
              }
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium transition-colors",
              tab === item.id
                ? "bg-[#e8f0fe] text-[var(--accent)] dark:bg-[var(--accent-soft)] dark:text-[var(--accent)]"
                : "text-[var(--ink)] hover:bg-[var(--surface-3)] dark:text-[var(--ink)] dark:hover:bg-[var(--surface-3)]",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </button>
        ))}

        <div className="my-2 h-px bg-[var(--line)] dark:bg-[var(--line)]" />

        <button
          type="button"
          onClick={() => {
            onNavigate?.("", true);
            window.location.href = "/buddy?fresh=true";
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-3)] dark:text-[var(--ink)] dark:hover:bg-[var(--surface-3)]"
        >
          <Bot className="h-5 w-5 shrink-0" />
          <span className="flex-1">AI Buddy</span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 px-2 pb-2">
        <div className="flex w-full flex-col justify-between rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4 text-left dark:border-[var(--line)] dark:bg-[var(--surface-3)]">
          <div className="flex flex-col">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] dark:bg-[var(--accent)]">
                <Zap className="h-4 w-4 text-white dark:text-[var(--ink)]" />
              </div>
              <Search className="h-4 w-4 text-[var(--ink-2)] dark:text-[var(--ink-3)]" />
            </div>
            <h3 className="mb-2 text-[14px] font-semibold tracking-tight text-[var(--ink)] dark:text-[var(--ink)]">
              AI Inbox Brain
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--ink-2)] dark:text-[var(--ink-3)]">
              Ask in plain English. Get structured answers and the threads
              behind them. Best on desktop.
            </p>
          </div>
          <div className="mt-4 text-[13px] font-medium text-[var(--accent)] dark:text-[var(--accent)]">
            Try on desktop
          </div>
        </div>
      </div>
    </div>
  );
}
