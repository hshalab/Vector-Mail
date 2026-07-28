import OpenAI from "openai";
import { env } from "@/env.js";
import { cache } from "@/lib/cache";
import { makeTagLogger } from "@/lib/logging/console-shim";

const intentLog = makeTagLogger("meeting-intent");

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000",
    "X-Title": "VectorMail AI",
  },
});

export type MeetingIntentType =
  | "wants_to_schedule"
  | "shared_their_calendar"
  | "vague_mention"
  | "none";

export interface MeetingIntentResult {
  has_meeting_intent: boolean;
  intent_type: MeetingIntentType;
  requested_constraints: string | null;
  confidence: number;
}
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export const MEETING_INTENT_SYSTEM_PROMPT = `You are a scheduling-intent classifier for an email assistant.
Given the subject and body of one email, decide whether the sender is trying to schedule a meeting or call.

Respond with STRICT JSON ONLY. No markdown fences. No commentary. No extra keys:
{
  "has_meeting_intent": true or false,
  "intent_type": "wants_to_schedule" | "shared_their_calendar" | "vague_mention" | "none",
  "requested_constraints": "<timing hints extracted verbatim, e.g. 'next week', 'Tuesday afternoon 30 min', or null>",
  "confidence": <float 0.0-1.0>
}

Intent type rules:
- "wants_to_schedule": sender explicitly asks to get on a call, book time, or find a meeting slot (e.g. "let's hop on a call", "book a slot", "find time this week")
- "shared_their_calendar": sender has shared a Calendly / scheduling link or pasted their calendar availability
- "vague_mention": meeting is mentioned but with no clear scheduling ask (e.g. "maybe we should chat someday")
- "none": no meeting intent detected

Output JSON only. Nothing else.`;

export async function classifyMeetingIntent(
  emailId: string,
  subject: string,
  bodyText: string,
  senderName: string | null,
  senderAddress: string,
): Promise<MeetingIntentResult | null> {
  const CACHE_KEY = `meeting-intent:v2:${emailId}`;
  const CACHE_TTL = 6 * 60 * 60 * 1000; 
  const cached = cache.get<MeetingIntentResult>(CACHE_KEY);
  if (cached !== null) return cached;

  const userMessage = [
    `Subject: ${subject}`,
    `From: ${senderName ? `${senderName} <${senderAddress}>` : senderAddress}`,
    "",
    bodyText.length > 2000 ? bodyText.substring(0, 2000) + "…" : bodyText,
  ].join("\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: [
        { role: "system", content: MEETING_INTENT_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      max_tokens: 150,
      temperature: 0.1,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    intentLog.log("[classifyMeetingIntent] emailId:", emailId, "raw:", raw.substring(0, 200));
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as MeetingIntentResult;

    if (typeof parsed.has_meeting_intent !== "boolean") {
      throw new Error("Response missing has_meeting_intent boolean");
    }
    cache.set(CACHE_KEY, parsed, CACHE_TTL);
    return parsed;
  } catch (err) {
    intentLog.error("[classifyMeetingIntent] failed for emailId:", emailId, err);
    return null;
  }
}
