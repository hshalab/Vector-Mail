"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Menu,
  X,
  Plus,
  Loader2,
  CircleHelp,
  ArrowLeft,
  CalendarClock,
  RefreshCw,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import {
  IconInbox,
  IconSent,
  IconSchedule,
  IconTrash,
  IconBuddy,
  IconNudge,
  IconCalendar,
  IconBolt,
  IconBrief,
  IconCompose,
} from "./icons";
import { DayScheduleCard, type DayEvent } from "./DayScheduleCard";
import { cn } from "@/lib/utils";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { UNIFIED_INBOX_ACCOUNT_ID } from "./AccountSwitcher";
import { ThreadList, type ThreadListRef } from "./threads-ui/ThreadList";
import { ThreadDisplay } from "./threads-ui/ThreadDisplay";
import EmailSearchAssistant from "../global/AskAi";
import SearchBar from "./search/SearchBar";
import ComposeEmailGmail from "./ComposeEmailGmail";
import { MailKeyboardShortcuts } from "./MailKeyboardShortcuts";
import { ShortcutHelpModal } from "./ShortcutHelpModal";
import { RequestAccessDialog } from "./RequestAccessDialog";
import { ProfileMenu } from "./ProfileMenu";
import { MobileSidebar } from "./MobileSidebar";
import { useResizableLayout } from "./useResizableLayout";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, formatDistanceToNow } from "date-fns";
import { useLocalStorage } from "usehooks-ts";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { LabelsList } from "./labels/LabelsList";
import { NudgesBlock } from "./NudgesBlock";
import { DailyBriefStrip } from "./DailyBriefStrip";
import { UpcomingFromEmailBlock } from "./UpcomingFromEmailBlock";
import { useDemoMode } from "@/hooks/use-demo-mode";
import { useSetAtom } from "jotai";
import { threadIdAtom } from "@/hooks/use-threads";
import { trackInboxBrainEvent } from "@/lib/analytics/inbox-brain";
import { AutopilotSection } from "@/components/mail/AutopilotSection";
import { AutomationOutcomeBanner } from "@/components/mail/AutomationOutcomeBanner";
import { CalendarSection } from "@/components/mail/CalendarSection";
import { MeetingRequestsWidget } from "@/components/mail/MeetingRequestsWidget";
import { BookingModal, type BookingCandidate } from "@/components/mail/BookingModal";
import { DEMO_ACCOUNT_ID } from "@/lib/demo/constants";
import { ConnectGmailScreen } from "./ConnectGmailScreen";
import { Skel } from "@/components/ui/skeletons";
import { MailShellSkeleton } from "@/components/mail/MailShellSkeleton";

function UpcomingMeetingsSkeleton({ pad = "px-5 py-3" }: { pad?: string }) {
  return (
    <div
      className="divide-y divide-[var(--line-soft)] dark:divide-[var(--line)]"
      aria-hidden
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn("flex flex-col gap-1.5", pad)}>
          <div className="flex items-center gap-2">
            <Skel delay={i * 60} className="h-4 w-16 rounded-md" />
            <Skel delay={i * 60 + 30} className="h-3 w-20 rounded" />
          </div>
          <Skel
            delay={i * 60 + 60}
            className="h-3.5 rounded"
            style={{ width: `${56 + ((i * 13) % 30)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

interface MailLayoutProps {
  defaultLayout?: number[] | readonly number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize?: number;
}


function buildDemoDay(): DayEvent[] {
  const now = new Date();
  const SPAN_BEFORE = 150;
  const SPAN_AFTER = 255;
  const anchor = Math.min(
    Math.max(
      Math.round((now.getHours() * 60 + now.getMinutes()) / 5) * 5,
      SPAN_BEFORE,
    ),
    24 * 60 - SPAN_AFTER,
  );
  return [
    {
      id: "standup",
      title: "Engineering standup",
      startMin: anchor - 150,
      endMin: anchor - 135,
      meta: "7 attendees",
    },
    {
      id: "screen",
      title: "Mei Lin · phone screen",
      startMin: anchor - 75,
      endMin: anchor - 30,
      meta: "Greenhouse req-2418",
    },
    {
      id: "renewal",
      title: "Brightlane renewal",
      startMin: anchor + 25,
      endMin: anchor + 55,
      meta: "Sophia + Tomas",
    },
    {
      id: "office-hours",
      title: "Hana · office hours",
      startMin: anchor + 120,
      endMin: anchor + 150,
      meta: "Forerunner",
    },
    {
      id: "design-review",
      title: "Design review · Q3 shell",
      startMin: anchor + 210,
      endMin: anchor + 255,
      meta: "Priya + Marcus",
    },
  ];
}

const THREAD_LIST_WIDTH_PCT = { min: 20, max: 55, fallback: 52 } as const;
const AI_PANEL_WIDTH_PX = { min: 320, max: 620, fallback: 360 } as const;

function threadListWidthPctDefault(
  defaultLayout?: number[] | readonly number[] | undefined,
): number {
  const raw = defaultLayout?.[1];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return THREAD_LIST_WIDTH_PCT.fallback;
  }

  if (raw >= 90) return THREAD_LIST_WIDTH_PCT.fallback;
  return Math.min(
    THREAD_LIST_WIDTH_PCT.max,
    Math.max(THREAD_LIST_WIDTH_PCT.min, Math.round(raw)),
  );
}

export function Mail({ defaultLayout }: MailLayoutProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [demoDay, setDemoDay] = useState<DayEvent[] | null>(null);
  useEffect(() => setDemoDay(buildDemoDay()), []);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiSearchResetKey, setAiSearchResetKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [tab, setTab] = useLocalStorage("vector-mail", "inbox");
  const [selectedLabelId, setSelectedLabelId] = useLocalStorage("vector-mail-label-id", "");
  const [sidebarWidthPct, setSidebarWidthPct] = useLocalStorage(
    "mail-sidebar-width-pct",
    threadListWidthPctDefault(defaultLayout),
  );
  const [sidebarLayoutHydrated, setSidebarLayoutHydrated] = useState(false);
  useEffect(() => setSidebarLayoutHydrated(true), []);
  const threadListLayoutWidthPct = sidebarLayoutHydrated
    ? sidebarWidthPct
    : threadListWidthPctDefault(defaultLayout);
  const [syncPending, setSyncPending] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [bookingCandidate, setBookingCandidate] = useState<BookingCandidate | null>(null);
  const [aiPanelWidthPx, setAiPanelWidthPx] = useLocalStorage<number>(
    "mail-ai-panel-width-px",
    AI_PANEL_WIDTH_PX.fallback,
  );
  const effectiveWidth = mounted ? aiPanelWidthPx : AI_PANEL_WIDTH_PX.fallback;
  const signOutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threadListRef = useRef<ThreadListRef>(null);
  const {
    containerRef,
    sidebarRef,
    isResizing,
    isAiResizing,
    handleResizeStart,
    handleAiResizeStart,
  } = useResizableLayout({
    sidebarWidthPct,
    setSidebarWidthPct,
    sidebarBoundsPct: THREAD_LIST_WIDTH_PCT,
    aiPanelWidthPx,
    setAiPanelWidthPx,
    aiPanelBoundsPx: AI_PANEL_WIDTH_PX,
    onAiPanelCommit: () => setSelectedThread(null),
  });
  const isMobile = useIsMobile();
  const isMacOS =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().includes("MAC");
  const { user } = useUser();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Account";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useClerk();

  useEffect(() => () => {
    if (signOutTimeoutRef.current) clearTimeout(signOutTimeoutRef.current);
  }, []);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  const handleSignOut = useCallback(() => {
    setIsSigningOut(true);
    const HANG_FALLBACK_MS = 4000;
    signOutTimeoutRef.current = setTimeout(() => {
      signOutTimeoutRef.current = null;
      window.location.replace("/");
    }, HANG_FALLBACK_MS);

    void signOut({ redirectUrl: "/" })
      .catch(() => {
        if (signOutTimeoutRef.current) {
          clearTimeout(signOutTimeoutRef.current);
          signOutTimeoutRef.current = null;
        }
        window.location.replace("/");
      });
  }, [signOut]);

  const focusSearch = useCallback(() => {
    document.getElementById("mail-search-input")?.focus();
  }, []);

  const focusReply = useCallback(() => {
    window.dispatchEvent(new CustomEvent("focus-reply"));
  }, []);

  const isDemo = useDemoMode();
  const { data: accounts, isLoading: accountsLoading } = api.account.getAccounts.useQuery();
  const firstAccountId = accounts && accounts.length > 0 ? accounts[0]!.id : "";
  const showConnectCard = !isDemo && !accountsLoading && !!accounts && accounts.length === 0;
  const [storedAccountId, setStoredAccountId] = useLocalStorage("accountId", "");
  useEffect(() => {
    if (storedAccountId) return;
    const qsAccountId = searchParams.get("accountId");
    if (!qsAccountId?.trim()) return;
    if (qsAccountId !== storedAccountId) {
      setStoredAccountId(qsAccountId);
    }
  }, [searchParams, storedAccountId, setStoredAccountId]);
  const firstConnectedAccountId =
    accounts?.find((acc) => !("needsReconnection" in acc) || !acc.needsReconnection)
      ?.id ?? firstAccountId;
  useEffect(() => {
    if (storedAccountId) return;
    if (!firstConnectedAccountId) return;
    setStoredAccountId(firstConnectedAccountId);
  }, [storedAccountId, firstConnectedAccountId, setStoredAccountId]);
  const storedAccount = accounts?.find((acc) => acc.id === storedAccountId);
  const accountId =
    storedAccountId === UNIFIED_INBOX_ACCOUNT_ID
      ? firstAccountId
      : storedAccount
        ? storedAccountId
        : firstConnectedAccountId;
  const calendarAccount = accountId ? accounts?.find((acc) => acc.id === accountId) : undefined;

  const { data: dailyBriefForCount } = api.account.getDailyBrief.useQuery(
    { accountId: accountId || "placeholder" },
    { enabled: !!accountId && accountId.length > 0 },
  );
  const { data: nudgesForCount } = api.account.getNudges.useQuery(
    { accountId: accountId || "placeholder" },
    { enabled: !!accountId && accountId.length > 0 },
  );
  const { data: autopilotPrefsForBadge } = api.automation.getPrefs.useQuery(
    { accountId: accountId || "" },
    { enabled: !!accountId && accountId.length > 0, staleTime: 10_000 },
  );
  const { data: autopilotToday } = api.automation.getTodaySummary.useQuery(
    { accountId: accountId || "" },
    { enabled: !!accountId && accountId.length > 0, staleTime: 30_000 },
  );
  const autopilotSent = autopilotToday?.sentRealToday ?? 0;
  const autopilotPending = autopilotToday?.pendingApproval ?? 0;
  const autopilotFailed = autopilotToday?.failedToday ?? 0;
  const autopilotSimulated = autopilotToday?.simulatedToday ?? 0;
  const autopilotHandled = autopilotSent + autopilotSimulated;
  const autopilotMinSaved = autopilotHandled * 5;
  const autopilotTotal =
    autopilotSent + autopilotSimulated + autopilotPending + autopilotFailed;
  const autopilotBreakdown = useMemo(
    () =>
      [
        { key: "sent", label: "Sent", value: autopilotSent },
        { key: "pending", label: "Pending", value: autopilotPending },
        { key: "sim", label: "Simulated", value: autopilotSimulated },
        { key: "failed", label: "Failed", value: autopilotFailed },
      ] as const,
    [autopilotSent, autopilotPending, autopilotSimulated, autopilotFailed],
  );
  const todaysBriefCount = dailyBriefForCount
    ? dailyBriefForCount.needsReply.length +
      dailyBriefForCount.important.length +
      dailyBriefForCount.lowPriority.length
    : null;
  const nudgesCount = nudgesForCount?.nudges?.length ?? null;
  const autopilotState =
    autopilotPrefsForBadge?.automationMode &&
    autopilotPrefsForBadge.automationMode !== "manual"
      ? "on"
      : autopilotPrefsForBadge
        ? "off"
        : null;

  const [upcomingPopoverOpen, setUpcomingPopoverOpen] = useState(false);
  const [dailyBriefPopoverOpen, setDailyBriefPopoverOpen] = useState(false);
  const [nudgesPopoverOpen, setNudgesPopoverOpen] = useState(false);
  const [mobileIntelOpen, setMobileIntelOpen] = useState<
    "brief" | "nudges" | "upcoming" | null
  >(null);
  const { data: upcomingMeetingsData, isLoading: upcomingLoading } =
    api.account.getUpcomingEventsFromEmails.useQuery(
      { accountId: accountId || "placeholder" },
      {
        enabled:
          !!accountId &&
          accountId.length > 0 &&
          (upcomingPopoverOpen || mobileIntelOpen === "upcoming"),
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      },
    );
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return (upcomingMeetingsData?.events ?? []).filter((e) => {
      const endTs = e.endAt ? new Date(e.endAt).getTime() : Number.NaN;
      const startTs = new Date(e.startAt).getTime();
      return Number.isFinite(endTs) ? endTs > now : startTs > now;
    });
  }, [upcomingMeetingsData?.events]);

  const setThreadId = useSetAtom(threadIdAtom);

  const handleThreadSelect = useCallback((threadId: string) => {
    setSelectedThread(threadId);
    setThreadId(threadId);
  }, [setThreadId]);

  const handleThreadClose = useCallback(() => {
    setSelectedThread(null);
    setThreadId(null);
  }, [setThreadId]);

  useEffect(() => {

    setSelectedThread(null);
    setThreadId(null);
  }, [accountId, setThreadId]);

  const toggleAIPanel = useCallback(() => {
    setShowAIPanel((open) => {
      if (open) return false;
      trackInboxBrainEvent("inbox_brain_panel_opened", { source: "keyboard" });
      return true;
    });
  }, []);

  const cycleBriefFocusFromShortcut = useCallback(() => {
    threadListRef.current?.cycleBriefFocus();
  }, []);

  const handleMobileNavigation = useCallback(
    (newTab?: string, isBuddy?: boolean) => {
      setIsNavigating(true);
      setSheetOpen(false);
      handleThreadClose();

      if (isBuddy) {
        router.push("/buddy?fresh=true");

        setTimeout(() => setIsNavigating(false), 800);
      } else if (newTab) {
        setTab(newTab);

        setTimeout(() => setIsNavigating(false), 600);
      }
    },
    [handleThreadClose, router, setTab],
  );

  const navItems = [
    { id: "inbox", icon: IconInbox, label: "Inbox" },
    { id: "sent", icon: IconSent, label: "Sent" },
    { id: "scheduled", icon: IconSchedule, label: "Schedule" },
    { id: "trash", icon: IconTrash, label: "Trash" },
  ];

  if (showConnectCard) {
    return <ConnectGmailScreen />;
  }

  if (isMobile) {
    return (
      <TooltipProvider delayDuration={0}>
        <MailKeyboardShortcuts
          selectedThread={selectedThread}
          setSelectedThread={setSelectedThread}
          mailTab={tab}
          setMailTab={setTab}
          focusSearch={focusSearch}
          openCompose={() => setComposeOpen(true)}
          focusReply={focusReply}
          onCloseThread={handleThreadClose}
          showHelp={() => setHelpOpen(true)}
          helpOpen={helpOpen}
          closeHelp={() => setHelpOpen(false)}
          toggleAIPanel={toggleAIPanel}
          cycleBriefFocus={cycleBriefFocusFromShortcut}
        />
        <ShortcutHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
        <div className="flex h-full min-h-0 w-full flex-col bg-[var(--surface-2)] dark:bg-[var(--surface)]">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] bg-white px-4 py-2.5 dark:border-[var(--line)] dark:bg-[var(--surface)] [padding-top:max(0.625rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {selectedThread ? (
                <button
                  type="button"
                  onClick={handleThreadClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] dark:text-[var(--ink-3)] dark:hover:bg-[var(--line)] dark:hover:text-[var(--ink)] [touch-action:manipulation]"
                  aria-label="Close email"
                  title="Close email"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              ) : (
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 [touch-action:manipulation]">
                      <Menu className="h-5 w-5" aria-label="Menu" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="flex w-[280px] flex-col min-h-0 overflow-y-auto border-[var(--line)] bg-white p-0 dark:border-[var(--line)] dark:bg-[var(--surface)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    <SheetTitle className="sr-only">VectorMail menu</SheetTitle>
                    <SheetDescription className="sr-only">
                      Navigate between folders, intelligence widgets, and your account.
                    </SheetDescription>
                    <MobileSidebar
                      navItems={navItems}
                      tab={tab}
                      setTab={setTab}
                      router={router}
                      onNavigate={handleMobileNavigation}
                    />
                    <div className="border-t border-[var(--line)] px-2 py-2 dark:border-[var(--line)]">
                      <LabelsList
                        accountId={accountId}
                        currentTab={tab}
                        selectedLabelId={tab === "label" ? selectedLabelId : null}
                        onLabelSelect={(id) => {
                          setTab("label");
                          setSelectedLabelId(id);
                          setSheetOpen(false);
                        }}
                        onLabelUnselect={() => {
                          setSelectedLabelId("");
                          setTab("inbox");
                        }}
                      />
                    </div>
                    <div className="border-t border-[var(--line)] px-2 py-2 dark:border-[var(--line)]">
                      <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#a39e93] dark:text-[var(--ink-3)]">
                        Intelligence
                      </div>
                      {(
                        [
                          {
                            icon: IconBrief,
                            label: "Today's brief",
                            count: todaysBriefCount,
                            key: "brief" as const,
                          },
                          {
                            icon: IconNudge,
                            label: "Nudges",
                            count: nudgesCount,
                            key: "nudges" as const,
                          },
                          {
                            icon: IconCalendar,
                            label: "Upcoming",
                            count: upcomingEvents.length || null,
                            key: "upcoming" as const,
                          },
                          {
                            icon: IconBolt,
                            label: "Autopilot",
                            count:
                              autopilotState === null
                                ? null
                                : autopilotState === "on"
                                  ? "On"
                                  : "Off",
                            key: "autopilot" as const,
                          },
                        ] as const
                      ).map((item) => {
                        if (item.key === "autopilot") {
                          return (
                            <div
                              key={item.label}
                              aria-disabled="true"
                              title="Autopilot is available on desktop only"
                              className="flex w-full cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                            >
                              <item.icon className="h-5 w-5 shrink-0 text-[#a39e93] dark:text-[var(--ink-2)]" />
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-medium text-[var(--ink-2)] dark:text-[var(--ink-3)]">
                                  {item.label}
                                </div>
                                <div className="mt-0.5 text-[11px] leading-snug text-[#a39e93] dark:text-[var(--ink-2)]">
                                  Available on desktop
                                </div>
                              </div>
                              <span
                                className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-2)] dark:border-[var(--line)] dark:bg-[var(--surface-3)] dark:text-[var(--ink-3)]"
                                style={{
                                  fontFamily:
                                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                                }}
                              >
                                Desktop
                              </span>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setSheetOpen(false);
                              setMobileIntelOpen(item.key);
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-3)] dark:text-[var(--ink)] dark:hover:bg-[var(--surface-3)] [touch-action:manipulation]"
                          >
                            <item.icon className="h-5 w-5 shrink-0 text-[var(--ink-2)] dark:text-[var(--ink-3)]" />
                            <span className="flex-1">{item.label}</span>
                            {item.count !== null && item.count !== undefined && (
                              <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] dark:bg-[var(--line)] dark:text-[var(--ink-3)]">
                                {item.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-auto border-t border-[var(--line)] p-3 dark:border-[var(--line)] [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
                      <div className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 dark:border-[var(--line)] dark:bg-[var(--surface-3)]">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--line)] dark:bg-[var(--line)]">
                          {user?.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[13px] font-semibold text-[var(--ink-2)] dark:text-[var(--ink-3)]">
                              {userName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[var(--ink)] dark:text-[var(--ink)]">
                            {userName}
                          </p>
                          {userEmail && (
                            <p className="truncate text-[11.5px] text-[var(--ink-2)] dark:text-[var(--ink-3)]">
                              {userEmail}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="flex min-h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-[var(--rose)] bg-white px-3 py-2.5 text-[14px] font-semibold text-[var(--rose)] transition-colors hover:bg-[var(--rose-soft)] disabled:opacity-70 dark:border-[var(--rose-soft)] dark:bg-[var(--surface-3)] dark:text-[var(--rose)] dark:hover:bg-[var(--rose-soft)] [touch-action:manipulation]"
                        aria-label={isSigningOut ? "Signing out" : "Sign out"}
                      >
                        {isSigningOut ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4 shrink-0" />
                        )}
                        <span>
                          {isSigningOut ? "Signing out…" : "Sign out"}
                        </span>
                      </button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <span className="min-w-0 truncate text-[15px] font-medium capitalize text-[var(--ink)] dark:text-[var(--ink)]">
                {selectedThread ? "Message" : (navItems.find((i) => i.id === tab)?.label ?? tab)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => threadListRef.current?.triggerSync()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] dark:text-[var(--ink-3)] dark:hover:bg-[var(--line)] dark:hover:text-[var(--ink)]"
                aria-label={syncPending ? "Stop sync" : "Sync Inbox, Sent, and Trash"}
              >
                <RefreshCw
                  className={cn("h-5 w-5", syncPending && "animate-spin")}
                />
              </button>
              <ComposeEmailGmail
                open={composeOpen}
                onOpenChange={setComposeOpen}
              />
              <ProfileMenu onSignOut={handleSignOut} isSigningOut={isSigningOut} />
            </div>
          </div>

          {isDemo && (
            <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--line-soft)] bg-[var(--surface-2)] px-4 py-2">
              <span className="vm-demo-badge shrink-0">Demo</span>
              <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-[var(--ink-3)]">
                Sample data — nothing here touches a real inbox.
              </span>
              <a
                href="mailto:parbhat@parbhat.dev?subject=VectorMail%20%E2%80%93%20Request%20access&body=Hi%2C%0A%0AI'd%20like%20to%20request%20access%20to%20connect%20my%20Gmail%20and%20use%20VectorMail%20with%20my%20own%20inbox.%20Please%20let%20me%20know%20when%20access%20is%20available.%0A%0AThank%20you."
                className="vm-demo-cta shrink-0"
              >
                Request access
              </a>
            </div>
          )}

          {isNavigating && (
            <div className="fixed inset-0 z-50">
              <MailShellSkeleton />
            </div>
          )}

          {!selectedThread ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-2)] dark:bg-[var(--surface)]">
              <SearchBar />
              <div className="min-h-0 flex-1 overflow-hidden">
                <ThreadList
                  ref={threadListRef}
                  onThreadSelect={handleThreadSelect}
                  onSyncPendingChange={setSyncPending}
                />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-[var(--surface)]">
              <ThreadDisplay threadId={selectedThread} onClose={handleThreadClose} />
            </div>
          )}

        </div>

        <Dialog
          open={mobileIntelOpen === "brief"}
          onOpenChange={(o) => !o && setMobileIntelOpen(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[min(640px,85vh)] w-[min(420px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-[var(--line)] bg-white p-0 dark:border-[var(--line)] dark:bg-[var(--surface)] sm:max-w-none"
          >
            <DialogTitle className="sr-only">Today&apos;s brief</DialogTitle>
            <DialogDescription className="sr-only">
              Today&apos;s prioritized email threads
            </DialogDescription>
            <div className="flex shrink-0 items-center justify-end border-b border-[var(--line)] px-2 py-1.5 dark:border-[var(--line)]">
              <button
                type="button"
                onClick={() => setMobileIntelOpen(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] dark:text-[var(--ink-3)] dark:hover:bg-[var(--line)] [touch-action:manipulation]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <DailyBriefStrip
                accountId={accountId}
                isDemo={isDemo}
                showDesktopShortcuts={false}
                defaultExpanded
                onThreadSelect={(threadId) => {
                  setMobileIntelOpen(null);
                  handleThreadSelect(threadId);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={mobileIntelOpen === "nudges"}
          onOpenChange={(o) => !o && setMobileIntelOpen(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[min(640px,85vh)] w-[min(420px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-[var(--line)] bg-white p-0 dark:border-[var(--line)] dark:bg-[var(--surface)] sm:max-w-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-4 dark:border-[var(--line)]">
              <div className="flex min-w-0 items-center gap-2.5">
                <Plus className="h-5 w-5 shrink-0 text-[var(--accent)] dark:text-[var(--ink-3)]" />
                <DialogTitle className="text-[16px] font-semibold tracking-tight text-[var(--ink)] dark:text-[var(--ink)]">
                  Nudges
                </DialogTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {nudgesCount !== null && nudgesCount > 0 && (
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] dark:bg-[var(--line)] dark:text-[var(--ink-3)]">
                    {nudgesCount}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setMobileIntelOpen(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] dark:text-[var(--ink-3)] dark:hover:bg-[var(--line)] [touch-action:manipulation]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Threads waiting on your reply
            </DialogDescription>
            <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(nudgesForCount?.nudges ?? []).length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-[14px] font-semibold text-[var(--ink)] dark:text-[var(--ink)]">
                    You&apos;re all caught up
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-3)]">
                    No threads are waiting on your reply right now.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)] dark:divide-[var(--line)]">
                  {(nudgesForCount?.nudges ?? []).map((nudge) => (
                    <li key={nudge.threadId}>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileIntelOpen(null);
                          handleThreadSelect(nudge.threadId);
                        }}
                        className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-3)] dark:hover:bg-[var(--line)] [touch-action:manipulation]"
                      >
                        <p className="line-clamp-2 text-[13.5px] font-medium text-[var(--ink)] dark:text-[var(--ink)]">
                          {nudge.thread?.subject ?? "(No subject)"}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                          <span>{nudge.reason ?? "You haven't replied"}</span>
                          {nudge.thread?.lastMessageDate && (
                            <>
                              <span className="text-[var(--ink-4)]">·</span>
                              <span>
                                {formatDistanceToNow(
                                  new Date(nudge.thread.lastMessageDate),
                                  { addSuffix: true },
                                )}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={mobileIntelOpen === "upcoming"}
          onOpenChange={(o) => !o && setMobileIntelOpen(null)}
        >
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[min(640px,85vh)] w-[min(420px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden border-[var(--line)] bg-white p-0 dark:border-[var(--line)] dark:bg-[var(--surface)] sm:max-w-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] px-5 py-4 dark:border-[var(--line)]">
              <div className="flex min-w-0 items-center gap-2.5">
                <CalendarClock className="h-5 w-5 shrink-0 text-[var(--accent)] dark:text-[var(--ink-3)]" />
                <DialogTitle className="text-[16px] font-semibold tracking-tight text-[var(--ink)] dark:text-[var(--ink)]">
                  Upcoming
                </DialogTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--ink-2)] dark:border-[var(--line)] dark:bg-[var(--surface-3)] dark:text-[var(--ink-3)]">
                  Last 60d
                </span>
                <button
                  type="button"
                  onClick={() => setMobileIntelOpen(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--ink)] dark:text-[var(--ink-3)] dark:hover:bg-[var(--line)] [touch-action:manipulation]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <DialogDescription className="sr-only">
              Upcoming meetings detected from your inbox
            </DialogDescription>
            <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {upcomingLoading ? (
                <UpcomingMeetingsSkeleton pad="px-5 py-3" />
              ) : upcomingEvents.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-[14px] font-semibold text-[var(--ink)] dark:text-[var(--ink)]">
                    No upcoming meetings
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-3)]">
                    We scan the last 60 days for Google Meet, Zoom, and Teams
                    links. Anything past its end time drops automatically.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--line-soft)] dark:divide-[var(--line)]">
                  {upcomingEvents.map((event) => {
                    const startDate = new Date(event.startAt);
                    const endDate = event.endAt
                      ? new Date(event.endAt)
                      : null;
                    const isToday =
                      startDate.toDateString() === new Date().toDateString();
                    const isTomorrow =
                      startDate.toDateString() ===
                      new Date(Date.now() + 86400000).toDateString();
                    const dayLabel = isToday
                      ? "Today"
                      : isTomorrow
                        ? "Tomorrow"
                        : format(startDate, "EEE, MMM d");
                    const timeLabel = format(startDate, "h:mm a");
                    return (
                      <li
                        key={`${event.sourceEmailId}-${event.startAt}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setMobileIntelOpen(null);
                            if (event.sourceThreadId) {
                              handleThreadSelect(event.sourceThreadId);
                            }
                          }}
                          className="flex w-full flex-col gap-1 px-5 py-3 text-left transition-colors hover:bg-[var(--surface-3)] dark:hover:bg-[var(--line)] [touch-action:manipulation]"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="rounded-md bg-[var(--accent)]/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)] dark:bg-[var(--line)] dark:text-[var(--ink-3)]">
                              {dayLabel}
                            </span>
                            <span className="text-[11.5px] font-medium text-[var(--ink-2)] dark:text-[var(--ink-3)]">
                              {timeLabel}
                              {endDate &&
                                endDate.getTime() !==
                                  startDate.getTime() &&
                                ` - ${format(endDate, "h:mm a")}`}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-[13.5px] font-medium text-[var(--ink)] dark:text-[var(--ink)]">
                            {event.title}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      {isSigningOut && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-white/95 backdrop-blur-sm dark:bg-[var(--surface)]"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-10 w-10 animate-spin text-[var(--accent)]" />
          <p className="text-[15px] font-medium text-[var(--ink)] dark:text-[var(--ink)]">Logging out…</p>
          <p className="text-[13px] text-[var(--ink-2)] dark:text-[var(--ink-4)]">Taking you to the home page</p>
        </div>
      )}
      <MailKeyboardShortcuts
        selectedThread={selectedThread}
        setSelectedThread={setSelectedThread}
        mailTab={tab}
        setMailTab={setTab}
        focusSearch={focusSearch}
        openCompose={() => setComposeOpen(true)}
        focusReply={focusReply}
        onCloseThread={handleThreadClose}
        showHelp={() => setHelpOpen(true)}
        helpOpen={helpOpen}
        closeHelp={() => setHelpOpen(false)}
        toggleAIPanel={toggleAIPanel}
        cycleBriefFocus={cycleBriefFocusFromShortcut}
      />
      <ShortcutHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
      <div className="vm-mockup flex h-full min-h-0 w-full">
        <aside className="sidebar w-[248px] shrink-0">
          <Link
            href="/"
            prefetch
            className="sidebar-head"
            style={{ textDecoration: "none" }}
          >
            <span className="brand-mark" style={{ background: "var(--primary)" }}>
              <video
                src="/Vectormail-logo.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full scale-[1.6] object-cover"
              />
            </span>
            <span className="brand-name">VectorMail</span>
            {isDemo && <span className="brand-tag">Demo</span>}
          </Link>

          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className="new-email-btn"
          >
            <IconCompose width={14} height={14} />
            <span>New email</span>
            <span className="kbd-mini">C</span>
          </button>

          <nav className="sidebar-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="sidebar-section">
              <div className="sidebar-label">
                <span>Folders</span>
              </div>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    if (item.id !== tab) setSelectedThread(null);
                  }}
                  className={cn("sidebar-item", tab === item.id && "active")}
                >
                  <item.icon className="icon" />
                  <span className="label-text">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="sidebar-section">
              <LabelsList
                accountId={accountId}
                currentTab={tab}
                selectedLabelId={tab === "label" ? selectedLabelId : null}
                onLabelSelect={(id) => {
                  setTab("label");
                  setSelectedLabelId(id);
                }}
                onLabelUnselect={() => {
                  setSelectedLabelId("");
                  setTab("inbox");
                }}
              />
            </div>

            <div className="sidebar-section">
              <div className="sidebar-label">
                <span>Intelligence</span>
              </div>

              <Popover
                open={dailyBriefPopoverOpen}
                onOpenChange={setDailyBriefPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Today's Brief"
                    className="sidebar-item is-intel brief-item"
                  >
                    <IconBrief className="icon" />
                    <span className="label-text">Today&apos;s Brief</span>
                    <span className="count">
                      {todaysBriefCount === null ? "-" : todaysBriefCount}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  className="w-[400px] max-w-[92vw] border-[var(--line)] bg-white p-0 text-[var(--ink)] shadow-lg"
                >
                  <div className="max-h-[640px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <DailyBriefStrip
                      accountId={accountId}
                      isDemo={isDemo}
                      onShowKeyboardHelp={() => setHelpOpen(true)}
                      showDesktopShortcuts={!isMobile}
                      defaultExpanded
                      onThreadSelect={(threadId) => {
                        handleThreadSelect(threadId);
                        setDailyBriefPopoverOpen(false);
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                onClick={() => {
                  if (isDemo) {
                    setRequestAccessOpen(true);
                  } else {
                    window.location.href = "/buddy?fresh=true";
                  }
                }}
                className="sidebar-item is-intel"
              >
                <IconBuddy className="icon" />
                <span className="label-text">AI Buddy</span>
              </button>

              <button
                type="button"
                title="Open VectorMail Inbox Brain"
                onClick={() => {
                  setShowAIPanel((prev) => {
                    if (!prev) {
                      trackInboxBrainEvent("inbox_brain_panel_opened", {
                        source: "sidebar",
                      });
                    }
                    return !prev;
                  });
                }}
                className={cn("sidebar-item is-intel", showAIPanel && "active")}
              >
                <span
                  className="icon"
                  style={{ overflow: "hidden", borderRadius: 5 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/Opus-B.png"
                    alt="Inbox brain"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="label-text">Inbox brain</span>
                {isDemo && <span className="badge-soft">Demo</span>}
              </button>

              <Popover
                open={nudgesPopoverOpen}
                onOpenChange={setNudgesPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Threads waiting on your reply"
                    className="sidebar-item is-intel"
                  >
                    <IconNudge className="icon" />
                    <span className="label-text">Nudges</span>
                    {nudgesCount !== null && (
                      <span className="count">{nudgesCount}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  className="w-[380px] max-w-[92vw] border-[var(--line)] bg-white p-0 text-[var(--ink)] shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
                    <p
                      className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]"
                      style={{
                        fontFamily:
                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                      }}
                    >
                      <span className="text-[var(--accent)]">✦</span>
                      NUDGES
                    </p>
                    {nudgesCount !== null && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                        {nudgesCount}
                      </span>
                    )}
                  </div>
                  <div className="max-h-[520px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {(nudgesForCount?.nudges ?? []).length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <p className="text-[13px] font-medium text-[var(--ink-1)]">
                          You&apos;re all caught up
                        </p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                          No threads are waiting on your reply right now.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-[var(--line-soft)]">
                        {(nudgesForCount?.nudges ?? []).map((nudge) => (
                          <li key={nudge.threadId}>
                            <button
                              type="button"
                              onClick={() => {
                                setNudgesPopoverOpen(false);
                                handleThreadSelect(nudge.threadId);
                              }}
                              className="group flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-3)]"
                            >
                              <p className="line-clamp-2 text-[13px] font-medium text-[var(--ink)] group-hover:text-[var(--accent)]">
                                {nudge.thread?.subject ?? "(No subject)"}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
                                <span>{nudge.reason ?? "You haven't replied"}</span>
                                {nudge.thread?.lastMessageDate && (
                                  <>
                                    <span className="text-[var(--ink-4)]">·</span>
                                    <span>
                                      {formatDistanceToNow(
                                        new Date(nudge.thread.lastMessageDate),
                                        { addSuffix: true },
                                      )}
                                    </span>
                                  </>
                                )}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover
                open={upcomingPopoverOpen}
                onOpenChange={setUpcomingPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Upcoming meetings from email"
                    className="sidebar-item is-intel"
                  >
                    <IconCalendar className="icon" />
                    <span className="label-text">Upcoming</span>
                    {upcomingEvents.length > 0 && (
                      <span className="count">{upcomingEvents.length}</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={12}
                  className="w-[360px] max-w-[90vw] border-[var(--line)] bg-white p-0 text-[var(--ink)] shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)]"
                      style={{
                        fontFamily:
                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                      }}
                    >
                      UPCOMING MEETINGS
                    </p>
                    <span className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-2)]">
                      Last 60d
                    </span>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {upcomingLoading ? (
                      <UpcomingMeetingsSkeleton pad="px-4 py-3" />
                    ) : upcomingEvents.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <p className="text-[13px] font-medium text-[var(--ink-1)]">
                          No upcoming meetings
                        </p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                          We scan the last 60 days for Google Meet, Zoom, and
                          Teams links. Anything past its end time is
                          automatically removed.
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-[var(--line-soft)]">
                        {upcomingEvents.map((event) => {
                          const startDate = new Date(event.startAt);
                          const endDate = event.endAt
                            ? new Date(event.endAt)
                            : null;
                          const isToday =
                            startDate.toDateString() ===
                            new Date().toDateString();
                          const isTomorrow =
                            startDate.toDateString() ===
                            new Date(Date.now() + 86400000).toDateString();
                          const dayLabel = isToday
                            ? "Today"
                            : isTomorrow
                              ? "Tomorrow"
                              : format(startDate, "EEE, MMM d");
                          const timeLabel = format(startDate, "h:mm a");
                          return (
                            <li key={`${event.sourceEmailId}-${event.startAt}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setUpcomingPopoverOpen(false);
                                  if (event.sourceThreadId) {
                                    handleThreadSelect(event.sourceThreadId);
                                  }
                                }}
                                className="group flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-[var(--surface-3)]"
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]"
                                    style={{
                                      fontFamily:
                                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                                    }}
                                  >
                                    {dayLabel}
                                  </span>
                                  <span
                                    className="text-[11px] font-medium text-[var(--ink-2)]"
                                    style={{
                                      fontFamily:
                                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                                    }}
                                  >
                                    {timeLabel}
                                    {endDate &&
                                      endDate.getTime() !==
                                        startDate.getTime() &&
                                      ` - ${format(endDate, "h:mm a")}`}
                                  </span>
                                  <span className="ml-auto text-[10px] text-[var(--ink-4)]">
                                    in {formatDistanceToNow(startDate)}
                                  </span>
                                </div>
                                <p className="line-clamp-2 text-[13px] font-medium text-[var(--ink)] group-hover:text-[var(--accent)]">
                                  {event.title}
                                </p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                type="button"
                title="Autopilot"
                onClick={() => setShowAIPanel(true)}
                className="sidebar-item is-intel"
              >
                <IconBolt className="icon" />
                <span className="label-text">Autopilot</span>
                {autopilotState !== null && (
                  <span className="count">{autopilotState}</span>
                )}
              </button>
            </div>

            {accountId && (
              <div className="ap-card">
                <div className="ap-head">
                  <span className="widget-chip">
                    <IconBolt />
                  </span>
                  <span className="ap-head-title">Autopilot today</span>
                  {autopilotState !== null && (
                    <span
                      className={cn(
                        "ap-status",
                        autopilotState === "on" && "is-on",
                      )}
                    >
                      {autopilotState === "on" ? "Live" : "Off"}
                    </span>
                  )}
                </div>

                {autopilotTotal > 0 ? (
                  <>
                    <div className="ap-hero">
                      <span className="ap-hero-value">{autopilotTotal}</span>
                      <span className="ap-hero-unit">
                        {autopilotTotal === 1 ? "action" : "actions"}
                      </span>
                      {autopilotMinSaved > 0 && (
                        <span className="ap-hero-saved">
                          ~{autopilotMinSaved} min saved
                        </span>
                      )}
                    </div>

                    <div
                      className="ap-meter"
                      role="img"
                      aria-label={autopilotBreakdown
                        .map((s) => `${s.value} ${s.label.toLowerCase()}`)
                        .join(", ")}
                    >
                      {autopilotBreakdown
                        .filter((s) => s.value > 0)
                        .map((s) => (
                          <span
                            key={s.key}
                            className={`ap-seg ${s.key}`}
                            style={{ flexGrow: s.value }}
                          />
                        ))}
                    </div>

                    <ul className="ap-legend">
                      {autopilotBreakdown.map((s) => (
                        <li key={s.key} data-zero={s.value === 0 || undefined}>
                          <span className={`ap-dot ${s.key}`} />
                          <span className="ap-legend-label">{s.label}</span>
                          <span className="ap-legend-value">{s.value}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="ap-empty">
                    Nothing sent or queued today. Follow-ups Autopilot handles
                    will show up here as they happen.
                  </p>
                )}
              </div>
            )}

            {accountId && !isDemo && (
              <CalendarSection
                accountId={accountId}
                calendarEnabled={calendarAccount?.calendarEnabled ?? false}
                emailAddress={calendarAccount?.emailAddress ?? ""}
              />
            )}

            {accountId && !isDemo && calendarAccount?.calendarEnabled && (
              <MeetingRequestsWidget
                accountId={accountId}
                onThreadSelect={handleThreadSelect}
                onBookMeeting={setBookingCandidate}
              />
            )}

            {accountId && isDemo && demoDay && (
              <DayScheduleCard events={demoDay} />
            )}
            <div style={{ display: "none" }} aria-hidden="true">
              {tab === "inbox" && (
                <DailyBriefStrip
                  accountId={accountId}
                  isDemo={isDemo}
                  onShowKeyboardHelp={() => setHelpOpen(true)}
                  showDesktopShortcuts={!isMobile}
                  onThreadSelect={handleThreadSelect}
                />
              )}
              <NudgesBlock
                accountId={accountId}
                onThreadSelect={handleThreadSelect}
              />
              <UpcomingFromEmailBlock
                accountId={accountId}
                onThreadSelect={handleThreadSelect}
              />
              {accountId ? (
                <AutomationOutcomeBanner
                  accountId={accountId}
                  isDemo={isDemo && accountId === DEMO_ACCOUNT_ID}
                  onOpenThread={handleThreadSelect}
                />
              ) : null}
            </div>
          </nav>

          <div className="sidebar-foot">
            <ProfileMenu onSignOut={handleSignOut} isSigningOut={isSigningOut} />
            <div className="user-info">
              <div className="user-name">{userName}</div>
              {userEmail && <div className="user-status">{userEmail}</div>}
            </div>
          </div>
        </aside>

        <div className="vm-main">
          {isDemo && (
            <div
              className="vm-demo-strip"
              style={{ marginRight: showAIPanel ? effectiveWidth + 10 : 0 }}
            >
              <span className="vm-demo-badge">Demo mode</span>
              <span className="vm-demo-text">
                You&apos;re exploring VectorMail with sample data — nothing here touches a real inbox.
              </span>
              <a
                href="mailto:parbhat@parbhat.dev?subject=VectorMail%20%E2%80%93%20Request%20access&body=Hi%2C%0A%0AI'd%20like%20to%20request%20access%20to%20connect%20my%20Gmail%20and%20use%20VectorMail%20with%20my%20own%20inbox.%20Please%20let%20me%20know%20when%20access%20is%20available.%0A%0AThank%20you."
                className="vm-demo-cta"
              >
                Request access
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path
                    d="M3 6h6M6 3l3 3-3 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          )}

          <div
            ref={containerRef}
            className={cn(
              "vm-columns",
              (isResizing || isAiResizing) && "select-none cursor-col-resize",
            )}
          >
            <aside
              ref={sidebarRef}
              className="vm-list-col"
              style={{
                width: `${threadListLayoutWidthPct}%`,
                minWidth: 300,
                ...(isResizing && { willChange: "width" }),
              }}
            >
              <div className="inbox-top">
                <div className="inbox-search-row">
                  <SearchBar />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => threadListRef.current?.triggerSync()}
                        className="inbox-refresh"
                        aria-label={syncPending ? "Stop sync" : "Sync emails"}
                      >
                        <RefreshCw
                          className={cn("h-3.5 w-3.5", syncPending && "animate-spin")}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-[var(--surface-3)] text-xs text-[var(--ink)]">
                      {syncPending ? "Syncing…" : "Sync emails"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ThreadList
                  ref={threadListRef}
                  onThreadSelect={handleThreadSelect}
                  onSyncPendingChange={setSyncPending}
                />
              </div>
            </aside>


            <div
              role="separator"
              aria-label="Resize panels"
              onPointerDown={handleResizeStart}
              className={cn("vm-resizer", isResizing && "is-active")}
            />

            <main
              className="vm-reader-col"
              style={{ marginRight: showAIPanel ? effectiveWidth + 10 : 0 }}
            >
              <ThreadDisplay threadId={selectedThread} onClose={handleThreadClose} />
            </main>


            <aside
              className="vm-ai-panel"
              data-open={showAIPanel ? "true" : "false"}
              style={{ width: effectiveWidth }}
            >
              <div
                role="separator"
                aria-label="Resize AI Inbox Brain panel"
                onPointerDown={handleAiResizeStart}
                className={cn("vm-ai-resizer", isAiResizing && "is-active")}
              />
              <div className="flex h-full flex-col">
                <div className="vm-ai-head">
                  <span className="vm-ai-mark">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/Opus-B.png"
                      alt="Inbox Brain"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="vm-ai-title truncate">Inbox brain</span>
                      {isDemo && <span className="badge-soft">Demo</span>}
                    </div>
                    {!isMobile && (
                      <p className="vm-ai-sub">
                        <kbd>{isMacOS ? "⌘↵" : "Ctrl+Enter"}</kbd>
                        to send
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {!isMobile && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setHelpOpen(true);
                            }}
                            className="vm-icon-btn"
                            aria-label="Keyboard shortcuts"
                          >
                            <CircleHelp className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[260px]">
                          <p>All mail &amp; Inbox brain shortcuts</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowAIPanel((prev) => {
                              if (!prev) {
                                trackInboxBrainEvent(
                                  "inbox_brain_panel_opened",
                                  { source: "toolbar_new_chat" },
                                );
                              }
                              return true;
                            });
                            setAiSearchResetKey((k) => k + 1);
                          }}
                          className="vm-icon-btn"
                          aria-label="New chat (AI Inbox Brain)"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p>New chat (Inbox brain)</p>
                      </TooltipContent>
                    </Tooltip>
                    <button
                      onClick={() => setShowAIPanel(false)}
                      className="vm-icon-btn"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {(accountId || isDemo) && (
                  <div className="shrink-0 border-b border-[var(--line-soft)] px-3 py-3">
                    <AutopilotSection accountId={isDemo ? DEMO_ACCOUNT_ID : accountId} isDemo={isDemo} />
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <EmailSearchAssistant
                    isCollapsed={false}
                    resetTrigger={aiSearchResetKey}
                    onOpenThread={handleThreadSelect}
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
      <div className="hidden">
        <ComposeEmailGmail
          open={composeOpen}
          onOpenChange={setComposeOpen}
        />
      </div>

      <RequestAccessDialog
        open={requestAccessOpen}
        onOpenChange={setRequestAccessOpen}
      />

      {bookingCandidate && accountId && (
        <BookingModal
          accountId={accountId}
          candidate={bookingCandidate}
          onClose={() => setBookingCandidate(null)}
        />
      )}
    </TooltipProvider>
  );
}

export default Mail;
