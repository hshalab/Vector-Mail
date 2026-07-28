import { env } from "@/env.js";
import axios from "axios";
import { makeTagLogger } from "@/lib/logging/console-shim";

const calApiLog = makeTagLogger("aurinko-calendar-api");

export const CALENDAR_SCOPES = "Mail.Read Mail.Send Calendar.ReadWrite";
const CALENDAR_RETURN_PATH = "/api/aurinko/calendar-callback";

function requireAurinkoClientId(): string {
  const id = env.AURINKO_CLIENT_ID;
  if (!id) throw new Error("AURINKO_CLIENT_ID is not set");
  return id;
}

export function buildCalendarAuthUrl(state?: string): string {
  const baseUrl = env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  const clientId = requireAurinkoClientId();
  const params = new URLSearchParams({
    clientId,
    serviceType: "Google",
    responseType: "code",
    returnUrl: `${baseUrl}${CALENDAR_RETURN_PATH}`,
    prompt: "consent",
    scopes: CALENDAR_SCOPES,
  });
  if (state) params.set("state", state);
  return `https://api.aurinko.io/v1/auth/authorize?${params.toString()}`;
}

function aurinkoHeaders(token: string, accountId: string) {
  return {
    Authorization: `Bearer ${token}`,
    "X-Aurinko-Account-Id": accountId,
  };
}

export async function validateMailScope(
  token: string,
  accountId: string,
): Promise<boolean> {
  try {
    await axios.get("https://api.aurinko.io/v1/email/messages", {
      headers: aurinkoHeaders(token, accountId),
      params: { maxResults: 1 },
      timeout: 10_000,
    });
    return true;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return false;
    }
    return false;
  }
}

export async function validateCalendarScope(
  token: string,
  accountId: string,
): Promise<boolean> {
  try {
    await axios.get("https://api.aurinko.io/v1/calendars/primary/events", {
      headers: aurinkoHeaders(token, accountId),
      params: { maxResults: 1 },
      timeout: 10_000,
    });
    return true;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403) return false;
    }
    return false;
  }
}

export interface AurinkoCalendarEvent {
  id: string;
  summary?: string;
  status?: string;
  transparency?: "opaque" | "transparent";
  start: {
    dateTime?: string; 
    date?: string;     
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
}

export async function fetchCalendarTimezone(
  token: string,
  accountId: string,
): Promise<string | null> {
  try {
    const response = await axios.get<{
      timeZone?: string;
      timezone?: string;
    }>("https://api.aurinko.io/v1/calendars/primary", {
      headers: aurinkoHeaders(token, accountId),
      timeout: 10_000,
    });
    calApiLog.log("[fetchCalendarTimezone] raw timezone field:", response.data?.timeZone ?? response.data?.timezone);
    return response.data?.timeZone ?? response.data?.timezone ?? null;
  } catch (err) {
    calApiLog.warn("[fetchCalendarTimezone] failed, will use fallback tz:", err);
    return null;
  }
}

export async function fetchCalendarEvents(
  token: string,
  accountId: string,
  timeMin: string,
  timeMax: string,
): Promise<AurinkoCalendarEvent[]> {
  const response = await axios.get<Record<string, unknown>>(
    "https://api.aurinko.io/v1/calendars/primary/events",
    {
      headers: aurinkoHeaders(token, accountId),
      params: {
        timeMin,
        timeMax,
        maxResults: 250,
        singleEvents: true,
        orderBy: "startTime",
      },
      timeout: 15_000,
    },
  );

  
  const data = response.data ?? {};
  calApiLog.log("[fetchCalendarEvents] response top-level keys:", Object.keys(data));
  const records = data["records"];
  const items = data["items"];
  calApiLog.log(
    "[fetchCalendarEvents] records:",
    Array.isArray(records) ? records.length : `(not array, type=${typeof records})`,
    "| items:",
    Array.isArray(items) ? items.length : `(not array, type=${typeof items})`,
  );

  const events = (Array.isArray(records) ? records : Array.isArray(items) ? items : []) as AurinkoCalendarEvent[];
  calApiLog.log("[fetchCalendarEvents] returning", events.length, "events");
  return events;
}

export interface CalendarEventInput {
  summary: string;
  startISO: string; 
  endISO: string;   
  timezone: string; 
  attendeeEmail: string;
}

export interface CreatedCalendarEvent {
  id: string;
  htmlLink?: string;
}

export async function createCalendarEvent(
  token: string,
  accountId: string,
  event: CalendarEventInput,
): Promise<CreatedCalendarEvent> {
  const response = await axios.post<{ id: string; htmlLink?: string }>(
    "https://api.aurinko.io/v1/calendars/primary/events",
    {
      summary: event.summary,
      start: { dateTime: event.startISO, timeZone: event.timezone },
      end: { dateTime: event.endISO, timeZone: event.timezone },
      attendees: [{ email: event.attendeeEmail }],
    },
    {
      headers: aurinkoHeaders(token, accountId),
      timeout: 15_000,
    },
  );
  calApiLog.log("[createCalendarEvent] created event id:", response.data.id);
  return { id: response.data.id, htmlLink: response.data.htmlLink };
}
