import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure } from "@/server/api/trpc";
import { withDbRetry } from "@/server/db";
import { isDemoCall } from "@/lib/demo/predicate";
import { decryptToken } from "@/lib/token-crypto";
import {
  fetchCalendarTimezone,
  fetchCalendarEvents,
} from "@/lib/aurinko-calendar";
import { computeFreeBusy } from "@/lib/calendar-freebusy";
import { makeTagLogger } from "@/lib/logging/console-shim";

const calLog = makeTagLogger("calendar-freebusy");

const FALLBACK_TZ = "America/New_York";

export const calendarProcedures = {
  getCalendarFreeBusy: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (isDemoCall(ctx, input.accountId)) {
        return { status: "not_connected" as const };
      }

      const account = await withDbRetry(() =>
        ctx.db.account.findFirst({
          where: { id: input.accountId, userId: ctx.auth.userId },
          select: {
            calendarEnabled: true,
            calendarAccountId: true,
            calendarToken: true,
          },
        }),
      );

      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }

      if (
        !account.calendarEnabled ||
        !account.calendarAccountId ||
        !account.calendarToken
      ) {
        return { status: "not_connected" as const };
      }

      const token = decryptToken(account.calendarToken);
      if (!token) {
        calLog.error(
          "[getCalendarFreeBusy] decrypt failed for account",
          input.accountId,
        );
        return {
          status: "error" as const,
          message: "Calendar credentials unavailable",
        };
      }

      try {
        const rawTz = await fetchCalendarTimezone(
          token,
          account.calendarAccountId,
        );
        const timezone = rawTz ?? FALLBACK_TZ;
        const now = new Date();
        const timeMin = new Date(
          now.getTime() - 24 * 60 * 60 * 1000,
        ).toISOString();
        const timeMax = new Date(
          now.getTime() + 8 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const events = await fetchCalendarEvents(
          token,
          account.calendarAccountId,
          timeMin,
          timeMax,
        );

        calLog.log(
          "[getCalendarFreeBusy] tz:",
          timezone,
          "| rawEvents:",
          events.length,
          "| timeMin:",
          timeMin,
        );

        const result = computeFreeBusy(events, timezone);

        return {
          status: "ok" as const,
          rawEventsFetched: events.length,
          ...result,
        };
      } catch (err) {
        calLog.error("[getCalendarFreeBusy] fetch error:", err);
        const message =
          err instanceof Error ? err.message : "Calendar fetch failed";
        return { status: "error" as const, message };
      }
    }),
};
