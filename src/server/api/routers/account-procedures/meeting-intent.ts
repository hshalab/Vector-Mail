import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure } from "@/server/api/trpc";
import { withDbRetry } from "@/server/db";
import { isDemoCall } from "@/lib/demo/predicate";
import { classifyMeetingIntent, stripHtml } from "@/lib/meeting-intent";
import { makeTagLogger } from "@/lib/logging/console-shim";

const meetLog = makeTagLogger("meeting-intent-proc");
type CandidateRow = {
  threadId: string;
  threadSubject: string;
  emailId: string;
  sentAt: Date;
  bodySnippet: string | null;
  body: string | null;
  senderName: string | null;
  senderAddress: string;
};

export type MeetingCandidate = {
  threadId: string;
  emailId: string;
  sender: { name: string | null; address: string };
  subject: string;
  snippet: string;
  latestMessageDateISO: string;
  intentType: "wants_to_schedule" | "shared_their_calendar";
  requestedConstraints: string | null;
  confidence: number;
};

export const meetingIntentProcedures = {
  getMeetingCandidates: protectedProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (isDemoCall(ctx, input.accountId)) {
        return { candidates: [] as MeetingCandidate[], scannedCount: 0 };
      }

      const account = await withDbRetry(() =>
        ctx.db.account.findFirst({
          where: { id: input.accountId, userId: ctx.auth.userId },
          select: { id: true },
        }),
      );
      if (!account) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Account not found",
        });
      }
      const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      const candidateRows = await ctx.db.$queryRaw<CandidateRow[]>`
        SELECT
          t.id                AS "threadId",
          t.subject           AS "threadSubject",
          e.id                AS "emailId",
          e."sentAt"          AS "sentAt",
          e."bodySnippet"     AS "bodySnippet",
          e.body              AS "body",
          ea.name             AS "senderName",
          ea.address          AS "senderAddress"
        FROM "Thread" t
        JOIN LATERAL (
          SELECT e2.*
          FROM "Email" e2
          WHERE e2."threadId" = t.id
          ORDER BY e2."sentAt" DESC
          LIMIT 1
        ) e ON TRUE
        JOIN "EmailAddress" ea ON ea.id = e."fromId"
        WHERE t."accountId" = ${input.accountId}
          AND t."inboxStatus" = true
          AND e."emailLabel" = 'inbox'
          AND e."sentAt" >= ${cutoff}
          AND NOT EXISTS (
            SELECT 1 FROM "Email" e3
            WHERE e3."threadId" = t.id
              AND e3."emailLabel" = 'sent'
              AND e3."sentAt" > e."sentAt"
          )
        ORDER BY e."sentAt" DESC
        LIMIT 30
      `;
      meetLog.log(`[STAGE-1 PREFILTER] ${candidateRows.length} threads passed`);
      for (const row of candidateRows) {
        meetLog.log(
          `[STAGE-1 PREFILTER]  thread=${row.threadId} email=${row.emailId}` +
            ` from="${row.senderAddress}" sentAt=${row.sentAt.toISOString()}` +
            ` emailLabel=inbox(confirmed-by-sql) unanswered=true(confirmed-by-sql)`,
        );
      }

      if (candidateRows.length === 0) {
        return { candidates: [] as MeetingCandidate[], scannedCount: 0 };
      }
      const results: MeetingCandidate[] = [];
      const BATCH = 4;

      for (let i = 0; i < candidateRows.length; i += BATCH) {
        const batch = candidateRows.slice(i, i + BATCH);
        const settled = await Promise.all(
          batch.map(async (row): Promise<MeetingCandidate | null> => {
            const bodyText = row.body
              ? stripHtml(row.body)
              : (row.bodySnippet ?? "");

            const classification = await classifyMeetingIntent(
              row.emailId,
              row.threadSubject,
              bodyText,
              row.senderName,
              row.senderAddress,
            );

            meetLog.log(
              `[STAGE-2 CLASSIFY] email=${row.emailId} from="${row.senderAddress}"` +
                ` result=${
                  classification === null
                    ? "NULL(error/cache-miss)"
                    : JSON.stringify({
                        has_meeting_intent: classification.has_meeting_intent,
                        intent_type: classification.intent_type,
                        confidence: classification.confidence,
                        requested_constraints:
                          classification.requested_constraints,
                      })
                }`,
            );
            if (classification === null) {
              meetLog.log(
                `[STAGE-3 THRESHOLD] email=${row.emailId} DROPPED: classification returned null (error)`,
              );
              return null;
            }
            if (!classification.has_meeting_intent) {
              meetLog.log(
                `[STAGE-3 THRESHOLD] email=${row.emailId} DROPPED: has_meeting_intent=false intent_type=${classification.intent_type} confidence=${classification.confidence}`,
              );
              return null;
            }
            if (
              classification.intent_type !== "wants_to_schedule" &&
              classification.intent_type !== "shared_their_calendar"
            ) {
              meetLog.log(
                `[STAGE-3 THRESHOLD] email=${row.emailId} DROPPED: intent_type="${classification.intent_type}" not in allowed set (wants_to_schedule|shared_their_calendar)`,
              );
              return null;
            }

            meetLog.log(
              `[STAGE-3 THRESHOLD] email=${row.emailId} PASSED: intent_type=${classification.intent_type} confidence=${classification.confidence}`,
            );

            const snippet =
              row.bodySnippet ??
              (bodyText ? bodyText.substring(0, 120) : "(no preview)");

            return {
              threadId: row.threadId,
              emailId: row.emailId,
              sender: { name: row.senderName, address: row.senderAddress },
              subject: row.threadSubject,
              snippet,
              latestMessageDateISO: row.sentAt.toISOString(),
              intentType: classification.intent_type,
              requestedConstraints: classification.requested_constraints,
              confidence: classification.confidence,
            };
          }),
        );

        for (const r of settled) {
          if (r !== null) results.push(r);
        }
      }

      meetLog.log(
        `[STAGE-3 THRESHOLD] final: ${results.length} surfaced of ${candidateRows.length} classified`,
      );
      return { candidates: results, scannedCount: candidateRows.length };
    }),
};
