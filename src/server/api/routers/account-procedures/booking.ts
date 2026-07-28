import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { decryptToken } from "@/lib/token-crypto";
import {
  fetchCalendarTimezone,
  fetchCalendarEvents,
  createCalendarEvent,
} from "@/lib/aurinko-calendar";
import { computeFreeBusy } from "@/lib/calendar-freebusy";
import { suggestSlots } from "@/lib/slot-suggestion";
import { sendReplyToThread } from "@/lib/email-reply";
import { log as auditLog } from "@/lib/audit/audit-log";
import { makeTagLogger } from "@/lib/logging/console-shim";

const bookingLog = makeTagLogger("booking");

export const bookingProcedures = {
  suggestMeetingSlots: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        threadId: z.string().min(1),
        requestedConstraints: z.string().nullable(),
        durationMinutes: z.number().int().min(15).max(180).default(30),
        senderName: z.string().nullable(),
        senderAddress: z.string().email(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const account = await db.account.findFirst({
        where: { id: input.accountId, userId: ctx.auth.userId },
        select: {
          id: true,
          name: true,
          calendarEnabled: true,
          calendarAccountId: true,
          calendarToken: true,
        },
      });

      if (
        !account?.calendarEnabled ||
        !account.calendarAccountId ||
        !account.calendarToken
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Calendar not connected",
        });
      }

      const thread = await db.thread.findFirst({
        where: { id: input.threadId },
        select: { subject: true },
      });

      const calToken = decryptToken(account.calendarToken);
      const now = new Date();
      const timeMin = new Date(
        now.getTime() - 24 * 60 * 60 * 1000,
      ).toISOString();
      const timeMax = new Date(
        now.getTime() + 8 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const timezone =
        (await fetchCalendarTimezone(calToken, account.calendarAccountId)) ??
        "UTC";
      const events = await fetchCalendarEvents(
        calToken,
        account.calendarAccountId,
        timeMin,
        timeMax,
      );
      const freeBusy = computeFreeBusy(events, timezone);

      const result = await suggestSlots({
        freeBusy,
        requestedConstraints: input.requestedConstraints,
        durationMinutes: input.durationMinutes,
        senderName: input.senderName,
        senderAddress: input.senderAddress,
        userName: account.name ?? "User",
      });

      if (result.status === "error") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.message,
        });
      }

      return {
        ...result,
        threadSubject: thread?.subject ?? null,
      };
    }),

  bookMeeting: protectedProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        threadId: z.string().min(1),
        slot: z.object({
          startISO: z.string(),
          endISO: z.string(),
          timezone: z.string(),
          label: z.string(),
        }),
        draftBody: z.string().min(1),
        attendeeEmail: z.string().email(),
        attendeeName: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await db.account.findFirst({
        where: { id: input.accountId, userId: ctx.auth.userId },
        select: {
          id: true,
          name: true,
          calendarEnabled: true,
          calendarAccountId: true,
          calendarToken: true,
        },
      });

      if (
        !account?.calendarEnabled ||
        !account.calendarAccountId ||
        !account.calendarToken
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Calendar not connected",
        });
      }

      const calToken = decryptToken(account.calendarToken);
      const eventTitle = `Meeting - ${input.attendeeName ?? input.attendeeEmail}`;
      let calendarEventId: string;
      try {
        const created = await createCalendarEvent(
          calToken,
          account.calendarAccountId,
          {
            summary: eventTitle,
            startISO: input.slot.startISO,
            endISO: input.slot.endISO,
            timezone: input.slot.timezone,
            attendeeEmail: input.attendeeEmail,
          },
        );
        calendarEventId = created.id;
        bookingLog.log("[bookMeeting] event created:", calendarEventId);
      } catch (err) {
        bookingLog.error("[bookMeeting] event creation failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create calendar event. Nothing was sent.",
        });
      }

      const sendResult = await sendReplyToThread({
        userId: ctx.auth.userId,
        threadId: input.threadId,
        body: input.draftBody,
        source: "calendar_booking",
      });

      if (!sendResult.ok) {
        bookingLog.warn(
          "[bookMeeting] partial failure - event created but reply failed:",
          sendResult.reason,
        );
        auditLog({
          userId: ctx.auth.userId,
          action: "calendar_booking_partial_failure",
          resourceId: input.threadId,
          metadata: {
            accountId: input.accountId,
            calendarEventId,
            slotStart: input.slot.startISO,
            slotEnd: input.slot.endISO,
            attendeeEmail: input.attendeeEmail,
            failureReason: sendResult.reason,
          },
        });
        return {
          ok: false as const,
          partialFailure: true,
          calendarEventId,
          message: `Calendar event booked (ID: ${calendarEventId}) but the reply could not be sent: ${sendResult.message} - you will need to reply manually.`,
        };
      }
      auditLog({
        userId: ctx.auth.userId,
        action: "calendar_booking_success",
        resourceId: input.threadId,
        metadata: {
          accountId: input.accountId,
          calendarEventId,
          slotStart: input.slot.startISO,
          slotEnd: input.slot.endISO,
          attendeeEmail: input.attendeeEmail,
          slot: input.slot.label,
        },
      });

      bookingLog.log(
        "[bookMeeting] success - event:",
        calendarEventId,
        "slot:",
        input.slot.label,
      );
      return {
        ok: true as const,
        partialFailure: false,
        calendarEventId,
        message: `Meeting booked for ${input.slot.label}`,
      };
    }),
} satisfies Parameters<typeof createTRPCRouter>[0];
