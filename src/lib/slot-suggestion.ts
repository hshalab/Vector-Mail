import OpenAI from "openai";
import { env } from "@/env.js";
import type { FreeBusyResult, DaySchedule } from "./calendar-freebusy";
import { makeTagLogger } from "@/lib/logging/console-shim";

const slotLog = makeTagLogger("slot-suggestion");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_URL || "https://vectormail.space",
    "X-Title": "VectorMail AI",
  },
  maxRetries: 0,
});

export interface SuggestedSlot {
  startISO: string;
  endISO: string;
  label: string;
  draftReplyBody: string;
  daySchedule: DaySchedule;
}

export type SlotSuggestionResult =
  | { status: "ok"; slots: SuggestedSlot[]; timezone: string }
  | { status: "no_slots"; message: string }
  | { status: "error"; message: string };

const SLOT_SYSTEM_PROMPT = `You are a scheduling assistant. Given free time windows and a meeting request, propose 2-3 specific meeting slots.

Return STRICT JSON ONLY - no markdown fences, no explanation:
{
  "slots": [
    {
      "startISO": "<ISO 8601 with UTC offset, e.g. 2026-07-07T11:00:00+05:30>",
      "endISO":   "<ISO 8601 with UTC offset>",
      "label":    "<readable, e.g. Tue Jul 7 at 11:00 AM>",
      "draftReplyBody": "<2-3 sentence plain-text reply proposing this specific slot>"
    }
  ]
}

Rules:
- Propose 2-3 slots. Never more.
- Every slot MUST fall fully within one of the provided free windows.
- The duration of each slot must equal the requested duration in minutes.
- Prefer times matching the constraint (day/time preference mentioned in the email).
- For draftReplyBody: warm, professional plain text. Address sender by first name. Propose THIS specific slot by its label. Sign with the user's first name. No HTML.
- Output ONLY the JSON object. Nothing else.`;

function fmtTime(isoStr: string, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoStr));
}

function formatFreeWindowsForPrompt(days: DaySchedule[], tz: string): string {
  return days
    .filter((d) => d.isWorkday && !d.allDayBlocked && d.free.length > 0)
    .map((d) => {
      const windows = d.free
        .map((s) => `${fmtTime(s.startISO, tz)} - ${fmtTime(s.endISO, tz)}`)
        .join(", ");
      return `${d.label}: ${windows}`;
    })
    .join("\n");
}

function isSlotFree(
  startISO: string,
  endISO: string,
  freeBusy: FreeBusyResult,
): boolean {
  const slotStart = new Date(startISO).getTime();
  const slotEnd = new Date(endISO).getTime();
  if (isNaN(slotStart) || isNaN(slotEnd) || slotEnd <= slotStart) return false;

  for (const day of freeBusy.days) {
    for (const freeSlot of day.free) {
      const freeStart = new Date(freeSlot.startISO).getTime();
      const freeEnd = new Date(freeSlot.endISO).getTime();
      if (slotStart >= freeStart && slotEnd <= freeEnd) return true;
    }
  }
  return false;
}

function findDaySchedule(
  startISO: string,
  freeBusy: FreeBusyResult,
): DaySchedule | null {
  const slotMs = new Date(startISO).getTime();
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: freeBusy.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(slotMs));
  return freeBusy.days.find((d) => d.dateStr === localDate) ?? null;
}

export async function suggestSlots(opts: {
  freeBusy: FreeBusyResult;
  requestedConstraints: string | null;
  durationMinutes: number;
  senderName: string | null;
  senderAddress: string;
  userName: string;
}): Promise<SlotSuggestionResult> {
  const {
    freeBusy,
    requestedConstraints,
    durationMinutes,
    senderName,
    senderAddress,
    userName,
  } = opts;

  const freeWindowsText = formatFreeWindowsForPrompt(
    freeBusy.days,
    freeBusy.timezone,
  );
  if (!freeWindowsText.trim()) {
    return {
      status: "no_slots",
      message: "No free windows in the next 7 working days.",
    };
  }

  const userPrompt = `Meeting request constraint: "${requestedConstraints ?? "no specific time - pick any convenient slot"}"
Duration: ${durationMinutes} minutes
Sender: ${senderName ? `${senderName} <${senderAddress}>` : senderAddress}
User's name: ${userName}

Free time windows in ${freeBusy.timezone}:
${freeWindowsText}

Propose 2-3 meeting slots from the free windows above.`;

  slotLog.log(
    "[suggestSlots] calling Claude with",
    freeBusy.days.filter((d) => d.isWorkday && d.free.length > 0).length,
    "free days",
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  let raw = "";
  try {
    const completion = await openai.chat.completions.create(
      {
        model: "anthropic/claude-haiku-4.5",
        messages: [
          { role: "system", content: SLOT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 900,
        temperature: 0.3,
        stream: false,
      },
      { signal: controller.signal },
    );
    raw = completion.choices[0]?.message?.content?.trim() ?? "";
    slotLog.log("[suggestSlots] Claude raw:", raw.slice(0, 200));
  } catch (err) {
    slotLog.error("[suggestSlots] Claude call failed:", err);
    return { status: "error", message: "Failed to generate slot suggestions." };
  } finally {
    clearTimeout(timeoutId);
  }

  const jsonStr = raw
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: {
    slots?: Array<{
      startISO?: string;
      endISO?: string;
      label?: string;
      draftReplyBody?: string;
    }>;
  };
  try {
    parsed = JSON.parse(jsonStr) as typeof parsed;
  } catch {
    slotLog.error("[suggestSlots] JSON parse error, raw:", raw);
    return {
      status: "error",
      message: "Could not parse slot suggestions from AI.",
    };
  }

  if (!Array.isArray(parsed.slots) || parsed.slots.length === 0) {
    return { status: "no_slots", message: "No slots were suggested." };
  }

  const senderFirstName = senderName?.split(" ")[0] ?? "there";
  const userFirstName = userName.split(" ")[0] ?? userName;

  const validated: SuggestedSlot[] = [];
  for (const slot of parsed.slots.slice(0, 4)) {
    const { startISO, endISO, label, draftReplyBody } = slot;
    if (!startISO || !endISO || !label) {
      slotLog.warn("[suggestSlots] skipping slot with missing fields:", slot);
      continue;
    }
    if (!isSlotFree(startISO, endISO, freeBusy)) {
      slotLog.warn(
        "[suggestSlots] slot failed free/busy check:",
        startISO,
        "-",
        endISO,
      );
      continue;
    }
    const daySchedule = findDaySchedule(startISO, freeBusy);
    if (!daySchedule) {
      slotLog.warn("[suggestSlots] could not map slot to a day:", startISO);
      continue;
    }
    validated.push({
      startISO,
      endISO,
      label,
      draftReplyBody:
        draftReplyBody?.trim() ||
        `Hi ${senderFirstName},\n\nHappy to connect! Does ${label} work for a ${durationMinutes}-minute call?\n\nBest,\n${userFirstName}`,
      daySchedule,
    });
    if (validated.length >= 3) break;
  }

  if (validated.length === 0) {
    slotLog.warn("[suggestSlots] all proposed slots failed validation");
    return {
      status: "no_slots",
      message:
        "No valid slots found - all suggestions conflicted with your calendar.",
    };
  }

  slotLog.log("[suggestSlots] returning", validated.length, "validated slots");
  return { status: "ok", slots: validated, timezone: freeBusy.timezone };
}
