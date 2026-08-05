import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import {
  bankAccounts,
  recurringSeries,
  transactions,
  type SeriesCadence,
  type SeriesKind,
} from "../db/schema.ts";

/**
 * Days either side of an expected date in which a real transaction still counts
 * as that occurrence. Covers weekend shifts and bank posting delays.
 */
export const MATCH_WINDOW_DAYS = 5;

/**
 * Amount tolerance used only when a series has no counterparty to match on.
 * With a counterparty we deliberately ignore amount, so a bonus or a raise
 * still matches the month it belongs to.
 */
const AMOUNT_TOLERANCE_RATIO = 0.15;

const CADENCES = new Set<string>(["weekly", "biweekly", "monthly", "quarterly"]);

function isCadence(value: string): value is SeriesCadence {
  return CADENCES.has(value);
}

/** Guard against a malformed series producing an unbounded projection. */
const MAX_OCCURRENCES = 600;

export class RecurringError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "RecurringError";
    this.code = code;
  }
}

export type OccurrenceStatus = "received" | "expected" | "late";

type DateParts = { year: number; month: number; day: number };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) {
    return false;
  }
  const parts = parseIsoDate(value);
  return parts.day <= daysInMonth(parts.year, parts.month);
}

function parseIsoDate(value: string): DateParts {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new RecurringError("invalid_date", `Expected a YYYY-MM-DD date, received "${value}".`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function toIsoDate(parts: DateParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toEpochDay(value: string): number {
  const { year, month, day } = parseIsoDate(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function fromEpochDay(epochDay: number): string {
  const date = new Date(epochDay * 86_400_000);
  return toIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addDays(value: string, days: number): string {
  return fromEpochDay(toEpochDay(value) + days);
}

export function diffDays(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Months since year 0, used to align monthly and quarterly steps. */
function monthIndex(parts: DateParts): number {
  return parts.year * 12 + (parts.month - 1);
}

function fromMonthIndex(index: number, anchorDay: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  // A series anchored on the 31st still lands in February — clamp to month end.
  return toIsoDate({ year, month, day: Math.min(anchorDay, daysInMonth(year, month)) });
}

export type ProjectableSeries = {
  cadence: string;
  startDate: string;
  endDate: string | null;
};

/**
 * Expected occurrence dates within `[rangeStart, rangeEnd]`, inclusive.
 * Pure function of the series definition — nothing is persisted.
 */
export function projectOccurrenceDates(
  series: ProjectableSeries,
  rangeStart: string,
  rangeEnd: string,
): string[] {
  if (diffDays(rangeStart, rangeEnd) < 0) {
    return [];
  }

  const effectiveEnd =
    series.endDate && diffDays(series.endDate, rangeEnd) > 0 ? series.endDate : rangeEnd;
  if (diffDays(rangeStart, effectiveEnd) < 0 || diffDays(series.startDate, effectiveEnd) < 0) {
    return [];
  }

  const dates: string[] = [];

  if (series.cadence === "monthly" || series.cadence === "quarterly") {
    const anchor = parseIsoDate(series.startDate);
    const step = series.cadence === "quarterly" ? 3 : 1;
    const startIndex = monthIndex(anchor);
    const rangeStartIndex = monthIndex(parseIsoDate(rangeStart));
    const stepsAhead = Math.max(0, Math.ceil((rangeStartIndex - startIndex) / step));

    let index = startIndex + stepsAhead * step;
    while (dates.length < MAX_OCCURRENCES) {
      const date = fromMonthIndex(index, anchor.day);
      if (diffDays(date, effectiveEnd) < 0) {
        break;
      }
      // Clamping can pull an occurrence back before rangeStart; skip, don't stop.
      if (diffDays(rangeStart, date) >= 0 && diffDays(series.startDate, date) >= 0) {
        dates.push(date);
      }
      index += step;
    }

    return dates;
  }

  const stepDays = series.cadence === "weekly" ? 7 : 14;
  const daysToRangeStart = diffDays(series.startDate, rangeStart);
  const stepsAhead = Math.max(0, Math.ceil(daysToRangeStart / stepDays));

  let date = addDays(series.startDate, stepsAhead * stepDays);
  while (diffDays(date, effectiveEnd) >= 0 && dates.length < MAX_OCCURRENCES) {
    dates.push(date);
    date = addDays(date, stepDays);
  }

  return dates;
}

type CandidateTransaction = {
  id: string;
  bankAccountId: string;
  bookingDate: string;
  amountMinor: number;
  currency: string;
  creditDebit: string;
  description: string | null;
  counterpartyName: string | null;
};

function normalizeCounterparty(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

function isCandidateFor(
  series: {
    bankAccountId: string;
    kind: string;
    counterpartyName: string | null;
    expectedAmountMinor: number;
  },
  transaction: CandidateTransaction,
): boolean {
  if (transaction.bankAccountId !== series.bankAccountId) {
    return false;
  }
  if (transaction.creditDebit !== (series.kind === "expense" ? "DBIT" : "CRDT")) {
    return false;
  }

  const seriesCounterparty = normalizeCounterparty(series.counterpartyName);
  if (seriesCounterparty) {
    return normalizeCounterparty(transaction.counterpartyName) === seriesCounterparty;
  }

  // No counterparty to key on — fall back to amount similarity.
  const expected = Math.abs(series.expectedAmountMinor);
  const tolerance = Math.max(1, Math.round(expected * AMOUNT_TOLERANCE_RATIO));
  return Math.abs(Math.abs(transaction.amountMinor) - expected) <= tolerance;
}

export type MatchedOccurrence = {
  expectedDate: string;
  expectedAmountMinor: number;
  status: OccurrenceStatus;
  transaction: {
    id: string;
    bookingDate: string;
    amountMinor: number;
    currency: string;
    description: string | null;
  } | null;
};

/**
 * Assign candidate transactions to projected dates, nearest first, each
 * transaction claimed at most once.
 */
export function matchOccurrences(
  series: {
    bankAccountId: string;
    kind: string;
    counterpartyName: string | null;
    expectedAmountMinor: number;
  },
  dates: string[],
  candidates: CandidateTransaction[],
  today: string,
): MatchedOccurrence[] {
  const pool = candidates.filter((transaction) => isCandidateFor(series, transaction));
  const claimed = new Set<string>();

  return dates.map((expectedDate) => {
    let best: CandidateTransaction | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const transaction of pool) {
      if (claimed.has(transaction.id)) {
        continue;
      }
      const distance = Math.abs(diffDays(expectedDate, transaction.bookingDate));
      if (distance <= MATCH_WINDOW_DAYS && distance < bestDistance) {
        best = transaction;
        bestDistance = distance;
      }
    }

    if (best) {
      claimed.add(best.id);
      return {
        expectedDate,
        expectedAmountMinor: series.expectedAmountMinor,
        status: "received" as const,
        transaction: {
          id: best.id,
          bookingDate: best.bookingDate,
          amountMinor: Math.abs(best.amountMinor),
          currency: best.currency,
          description: best.description,
        },
      };
    }

    const overdue = diffDays(addDays(expectedDate, MATCH_WINDOW_DAYS), today) > 0;
    return {
      expectedDate,
      expectedAmountMinor: series.expectedAmountMinor,
      status: overdue ? ("late" as const) : ("expected" as const),
      transaction: null,
    };
  });
}

function serializeSeries(row: typeof recurringSeries.$inferSelect) {
  return {
    id: row.id,
    bankAccountId: row.bankAccountId,
    seedTransactionId: row.seedTransactionId,
    kind: row.kind,
    label: row.label,
    counterpartyName: row.counterpartyName,
    expectedAmountMinor: row.expectedAmountMinor,
    currency: row.currency,
    cadence: row.cadence,
    startDate: row.startDate,
    endDate: row.endDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedSeries = ReturnType<typeof serializeSeries>;

export async function createSeriesFromTransaction(
  db: Db,
  userId: string,
  input: {
    transactionId: string;
    cadence: SeriesCadence;
    label?: string | null;
    expectedAmountMinor?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<SerializedSeries> {
  const cadence: string = input.cadence;
  if (!isCadence(cadence)) {
    throw new RecurringError("invalid_cadence", `Unsupported cadence "${cadence}".`);
  }

  const seed = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, input.transactionId), eq(transactions.userId, userId)))
    .get();

  if (!seed) {
    throw new RecurringError("transaction_not_found", "Transaction not found.");
  }

  const kind: SeriesKind = seed.creditDebit === "DBIT" ? "expense" : "income";
  const startDate = input.startDate ?? seed.bookingDate;
  const endDate = input.endDate ?? null;

  if (!isIsoDate(startDate)) {
    throw new RecurringError("invalid_date", "startDate must be a valid YYYY-MM-DD date.");
  }
  if (endDate !== null) {
    if (!isIsoDate(endDate)) {
      throw new RecurringError("invalid_date", "endDate must be a valid YYYY-MM-DD date.");
    }
    if (diffDays(startDate, endDate) < 0) {
      throw new RecurringError("invalid_date_range", "endDate must not precede startDate.");
    }
  }

  const expectedAmountMinor = Math.abs(input.expectedAmountMinor ?? seed.amountMinor);
  if (!Number.isSafeInteger(expectedAmountMinor) || expectedAmountMinor <= 0) {
    throw new RecurringError(
      "invalid_amount",
      "expectedAmountMinor must be a positive whole number of minor units.",
    );
  }

  const label =
    input.label?.trim() ||
    seed.counterpartyName?.trim() ||
    seed.description?.trim() ||
    (kind === "income" ? "Recurring income" : "Recurring payment");

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(recurringSeries).values({
    id,
    userId,
    bankAccountId: seed.bankAccountId,
    seedTransactionId: seed.id,
    kind,
    label: label.slice(0, 120),
    counterpartyName: seed.counterpartyName,
    expectedAmountMinor,
    currency: seed.currency,
    cadence: input.cadence,
    startDate,
    endDate,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.select().from(recurringSeries).where(eq(recurringSeries.id, id)).get();
  if (!created) {
    throw new RecurringError("create_failed", "Failed to create the recurring series.");
  }

  return serializeSeries(created);
}

export async function updateSeriesForUser(
  db: Db,
  userId: string,
  seriesId: string,
  patch: {
    label?: string | undefined;
    expectedAmountMinor?: number | undefined;
    cadence?: SeriesCadence | undefined;
    startDate?: string | undefined;
    endDate?: string | null | undefined;
  },
): Promise<SerializedSeries> {
  const existing = await db
    .select()
    .from(recurringSeries)
    .where(and(eq(recurringSeries.id, seriesId), eq(recurringSeries.userId, userId)))
    .get();

  if (!existing) {
    throw new RecurringError("series_not_found", "Recurring series not found.");
  }

  const next = {
    label: patch.label?.trim() || existing.label,
    expectedAmountMinor: patch.expectedAmountMinor ?? existing.expectedAmountMinor,
    cadence: patch.cadence ?? existing.cadence,
    startDate: patch.startDate ?? existing.startDate,
    endDate: patch.endDate === undefined ? existing.endDate : patch.endDate,
  };

  if (!isCadence(next.cadence)) {
    throw new RecurringError("invalid_cadence", `Unsupported cadence "${next.cadence}".`);
  }
  if (!isIsoDate(next.startDate)) {
    throw new RecurringError("invalid_date", "startDate must be a valid YYYY-MM-DD date.");
  }
  if (next.endDate !== null) {
    if (!isIsoDate(next.endDate)) {
      throw new RecurringError("invalid_date", "endDate must be a valid YYYY-MM-DD date.");
    }
    if (diffDays(next.startDate, next.endDate) < 0) {
      throw new RecurringError("invalid_date_range", "endDate must not precede startDate.");
    }
  }
  if (!Number.isSafeInteger(next.expectedAmountMinor) || next.expectedAmountMinor <= 0) {
    throw new RecurringError(
      "invalid_amount",
      "expectedAmountMinor must be a positive whole number of minor units.",
    );
  }

  await db
    .update(recurringSeries)
    .set({
      label: next.label.slice(0, 120),
      expectedAmountMinor: Math.abs(next.expectedAmountMinor),
      cadence: next.cadence,
      startDate: next.startDate,
      endDate: next.endDate,
      updatedAt: new Date(),
    })
    .where(and(eq(recurringSeries.id, seriesId), eq(recurringSeries.userId, userId)));

  const updated = await db
    .select()
    .from(recurringSeries)
    .where(eq(recurringSeries.id, seriesId))
    .get();
  if (!updated) {
    throw new RecurringError("series_not_found", "Recurring series not found.");
  }

  return serializeSeries(updated);
}

export async function deleteSeriesForUser(db: Db, userId: string, seriesId: string): Promise<void> {
  const result = await db
    .delete(recurringSeries)
    .where(and(eq(recurringSeries.id, seriesId), eq(recurringSeries.userId, userId)));

  if (result.meta.changes === 0) {
    throw new RecurringError("series_not_found", "Recurring series not found.");
  }
}

async function selectSeries(db: Db, userId: string, kind?: SeriesKind) {
  const filters = [eq(recurringSeries.userId, userId)];
  if (kind) {
    filters.push(eq(recurringSeries.kind, kind));
  }

  return db
    .select()
    .from(recurringSeries)
    .where(and(...filters))
    .orderBy(asc(recurringSeries.startDate), asc(recurringSeries.createdAt))
    .all();
}

export async function listSeriesForUser(db: Db, userId: string, kind?: SeriesKind) {
  const rows = await selectSeries(db, userId, kind);
  if (rows.length === 0) {
    return [];
  }

  const accountRows = await db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      customName: bankAccounts.customName,
    })
    .from(bankAccounts)
    .where(
      inArray(
        bankAccounts.id,
        rows.map((row) => row.bankAccountId),
      ),
    )
    .all();

  const accountNames = new Map(
    accountRows.map((account) => [
      account.id,
      account.customName?.trim() || account.name?.trim() || "Unnamed account",
    ]),
  );

  return rows.map((row) =>
    Object.assign(serializeSeries(row), {
      accountName: accountNames.get(row.bankAccountId) ?? "Unnamed account",
    }),
  );
}

export type OccurrenceRow = MatchedOccurrence & {
  seriesId: string;
  label: string;
  kind: string;
  currency: string;
  counterpartyName: string | null;
  bankAccountId: string;
};

/**
 * Projected occurrences in a date range with their matched transactions.
 * Totals stay per-currency — no FX conversion is applied anywhere.
 */
export async function getOccurrencesForUser(
  db: Db,
  userId: string,
  options: { from: string; to: string; kind?: SeriesKind; now?: Date },
): Promise<{
  range: { from: string; to: string };
  occurrences: OccurrenceRow[];
  totals: {
    currency: string;
    receivedMinor: number;
    outstandingMinor: number;
    projectedMinor: number;
  }[];
}> {
  if (!isIsoDate(options.from) || !isIsoDate(options.to)) {
    throw new RecurringError("invalid_date", "from and to must be valid YYYY-MM-DD dates.");
  }
  if (diffDays(options.from, options.to) < 0) {
    throw new RecurringError("invalid_date_range", "to must not precede from.");
  }

  const today = todayIso(options.now);
  const seriesRows = await selectSeries(db, userId, options.kind);

  if (seriesRows.length === 0) {
    return { range: { from: options.from, to: options.to }, occurrences: [], totals: [] };
  }

  // One query covering every series; the match window widens the bounds.
  const candidates: CandidateTransaction[] = await db
    .select({
      id: transactions.id,
      bankAccountId: transactions.bankAccountId,
      bookingDate: transactions.bookingDate,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      creditDebit: transactions.creditDebit,
      description: transactions.description,
      counterpartyName: transactions.counterpartyName,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.bookingDate, addDays(options.from, -MATCH_WINDOW_DAYS)),
        lte(transactions.bookingDate, addDays(options.to, MATCH_WINDOW_DAYS)),
      ),
    )
    .all();

  const claimedAcrossSeries = new Set<string>();
  const occurrences: OccurrenceRow[] = [];

  for (const series of seriesRows) {
    const dates = projectOccurrenceDates(series, options.from, options.to);
    const available = candidates.filter((transaction) => !claimedAcrossSeries.has(transaction.id));
    const matched = matchOccurrences(series, dates, available, today);

    for (const occurrence of matched) {
      if (occurrence.transaction) {
        claimedAcrossSeries.add(occurrence.transaction.id);
      }
      occurrences.push({
        ...occurrence,
        seriesId: series.id,
        label: series.label,
        kind: series.kind,
        currency: series.currency,
        counterpartyName: series.counterpartyName,
        bankAccountId: series.bankAccountId,
      });
    }
  }

  occurrences.sort(
    (left, right) =>
      diffDays(right.expectedDate, left.expectedDate) || left.label.localeCompare(right.label),
  );

  const totalsByCurrency = new Map<string, { receivedMinor: number; outstandingMinor: number }>();
  for (const occurrence of occurrences) {
    const bucket = totalsByCurrency.get(occurrence.currency) ?? {
      receivedMinor: 0,
      outstandingMinor: 0,
    };
    if (occurrence.transaction) {
      bucket.receivedMinor += occurrence.transaction.amountMinor;
    } else {
      bucket.outstandingMinor += occurrence.expectedAmountMinor;
    }
    totalsByCurrency.set(occurrence.currency, bucket);
  }

  return {
    range: { from: options.from, to: options.to },
    occurrences,
    totals: Array.from(totalsByCurrency, ([currency, bucket]) => ({
      currency,
      receivedMinor: bucket.receivedMinor,
      outstandingMinor: bucket.outstandingMinor,
      projectedMinor: bucket.receivedMinor + bucket.outstandingMinor,
    })),
  };
}

/** First and last day of the month containing `date`. */
export function monthRange(date: string): { from: string; to: string } {
  const { year, month } = parseIsoDate(date);
  return {
    from: toIsoDate({ year, month, day: 1 }),
    to: toIsoDate({ year, month, day: daysInMonth(year, month) }),
  };
}
