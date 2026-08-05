import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { app } from "../app.ts";
import { createDb } from "../db/index.ts";
import { bankAccounts, connections, transactions, users } from "../db/schema.ts";
import { allowEmail, cookieHeaderFromResponse, resetAuthState, testEnv } from "../test/fixtures.ts";
import {
  matchOccurrences,
  monthRange,
  projectOccurrenceDates,
  type MatchedOccurrence,
} from "./recurring.ts";

const password = "correct-horse-battery-staple";

const seriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  cadence: z.string(),
  counterpartyName: z.string().nullable(),
  expectedAmountMinor: z.number(),
  currency: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
});

const occurrencesSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  occurrences: z.array(
    z.object({
      seriesId: z.string(),
      label: z.string(),
      expectedDate: z.string(),
      expectedAmountMinor: z.number(),
      status: z.enum(["received", "expected", "late"]),
      transaction: z
        .object({ id: z.string(), bookingDate: z.string(), amountMinor: z.number() })
        .nullable(),
    }),
  ),
  totals: z.array(
    z.object({
      currency: z.string(),
      receivedMinor: z.number(),
      outstandingMinor: z.number(),
      projectedMinor: z.number(),
    }),
  ),
});

function monthly(startDate: string, endDate: string | null = null) {
  return { cadence: "monthly", startDate, endDate };
}

describe("occurrence projection", () => {
  it("projects monthly occurrences anchored on the start date", () => {
    expect(projectOccurrenceDates(monthly("2026-01-10"), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-10",
      "2026-02-10",
      "2026-03-10",
      "2026-04-10",
    ]);
  });

  it("clamps a month-end anchor to short months", () => {
    expect(projectOccurrenceDates(monthly("2026-01-31"), "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("stops at the end date", () => {
    expect(
      projectOccurrenceDates(monthly("2026-01-15", "2026-03-31"), "2026-01-01", "2026-12-31"),
    ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15"]);
  });

  it("never projects before the start date", () => {
    expect(projectOccurrenceDates(monthly("2026-06-01"), "2026-01-01", "2026-07-31")).toEqual([
      "2026-06-01",
      "2026-07-01",
    ]);
  });

  it("keeps quarterly steps aligned to the start month", () => {
    expect(
      projectOccurrenceDates(
        { cadence: "quarterly", startDate: "2026-02-05", endDate: null },
        "2026-06-01",
        "2026-12-31",
      ),
    ).toEqual(["2026-08-05", "2026-11-05"]);
  });

  it("steps weekly and biweekly by whole days", () => {
    expect(
      projectOccurrenceDates(
        { cadence: "weekly", startDate: "2026-03-02", endDate: null },
        "2026-03-01",
        "2026-03-29",
      ),
    ).toEqual(["2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"]);

    expect(
      projectOccurrenceDates(
        { cadence: "biweekly", startDate: "2026-03-02", endDate: null },
        "2026-03-10",
        "2026-04-15",
      ),
    ).toEqual(["2026-03-16", "2026-03-30", "2026-04-13"]);
  });

  it("returns nothing once the series has ended", () => {
    expect(
      projectOccurrenceDates(monthly("2025-01-01", "2025-12-31"), "2026-01-01", "2026-12-31"),
    ).toEqual([]);
  });
});

type CandidateTransaction = Parameters<typeof matchOccurrences>[2][number];

function transaction(overrides: Partial<CandidateTransaction>): CandidateTransaction {
  return {
    id: crypto.randomUUID(),
    bankAccountId: "acct-1",
    bookingDate: "2026-03-01",
    amountMinor: 720_000,
    currency: "PLN",
    creditDebit: "CRDT",
    description: null,
    counterpartyName: "Acme Software Sp. z o.o.",
    ...overrides,
  };
}

function statuses(matched: MatchedOccurrence[]) {
  return matched.map((occurrence) => occurrence.status);
}

describe("occurrence matching", () => {
  const series = {
    bankAccountId: "acct-1",
    kind: "income",
    counterpartyName: "Acme Software Sp. z o.o.",
    expectedAmountMinor: 720_000,
  };

  it("matches a transaction that lands a few days off the expected date", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01"],
      [transaction({ bookingDate: "2026-03-04" })],
      "2026-03-10",
    );

    expect(statuses(matched)).toEqual(["received"]);
    expect(matched[0]?.transaction?.bookingDate).toBe("2026-03-04");
  });

  it("ignores a transaction outside the match window", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01"],
      [transaction({ bookingDate: "2026-03-09" })],
      "2026-03-20",
    );

    expect(statuses(matched)).toEqual(["late"]);
  });

  it("matches on counterparty regardless of amount, so a bonus month still counts", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01"],
      [transaction({ bookingDate: "2026-03-01", amountMinor: 1_100_000 })],
      "2026-03-10",
    );

    expect(statuses(matched)).toEqual(["received"]);
    expect(matched[0]?.transaction?.amountMinor).toBe(1_100_000);
  });

  it("rejects a different counterparty on the same account", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01"],
      [transaction({ counterpartyName: "Someone Else" })],
      "2026-03-20",
    );

    expect(statuses(matched)).toEqual(["late"]);
  });

  it("never assigns one transaction to two occurrences", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01", "2026-04-01"],
      [transaction({ bookingDate: "2026-03-30" })],
      "2026-04-20",
    );

    // Nearest to 2026-04-01 wins; March is then left unmatched.
    expect(statuses(matched)).toEqual(["late", "received"]);
  });

  it("treats an unmatched future occurrence as expected, not late", () => {
    const matched = matchOccurrences(series, ["2026-03-01", "2026-04-01"], [], "2026-03-10");

    expect(statuses(matched)).toEqual(["late", "expected"]);
  });

  it("stays within the grace window before calling an occurrence late", () => {
    const matched = matchOccurrences(series, ["2026-03-01"], [], "2026-03-05");

    expect(statuses(matched)).toEqual(["expected"]);
  });

  it("falls back to amount similarity when the series has no counterparty", () => {
    const anonymous = { ...series, counterpartyName: null };
    const matched = matchOccurrences(
      anonymous,
      ["2026-03-01", "2026-04-01"],
      [
        transaction({ bookingDate: "2026-03-01", counterpartyName: null, amountMinor: 730_000 }),
        transaction({ bookingDate: "2026-04-01", counterpartyName: null, amountMinor: 200_000 }),
      ],
      "2026-04-20",
    );

    expect(statuses(matched)).toEqual(["received", "late"]);
  });

  it("ignores debits when the series is income", () => {
    const matched = matchOccurrences(
      series,
      ["2026-03-01"],
      [transaction({ creditDebit: "DBIT" })],
      "2026-03-20",
    );

    expect(statuses(matched)).toEqual(["late"]);
  });
});

describe("month range", () => {
  it("spans the whole calendar month", () => {
    expect(monthRange("2026-02-17")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-12-01")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

async function signUp(email: string) {
  return app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ email, password, name: "Numra User" }),
    },
    env,
  );
}

async function authedRequest(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  headers.set("origin", "http://localhost:5173");
  return app.request(path, { ...init, headers }, env);
}

/** Signed-in user with one bank account and the given credit transactions. */
async function seedLedger(
  email: string,
  bookings: { bookingDate: string; amountMinor: number; counterpartyName: string | null }[],
) {
  await allowEmail(email);
  const cookie = cookieHeaderFromResponse(await signUp(email));

  const db = createDb(testEnv());
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    throw new Error("Seed user was not created.");
  }

  const connectionId = crypto.randomUUID();
  const bankAccountId = crypto.randomUUID();
  const now = new Date();

  await db.insert(connections).values({
    id: connectionId,
    userId: user.id,
    provider: "enable_banking",
    status: "active",
    aspspName: "PKO Bank Polski",
    aspspCountry: "PL",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(bankAccounts).values({
    id: bankAccountId,
    userId: user.id,
    connectionId,
    providerAccountId: "provider-account-1",
    identificationHash: crypto.randomUUID(),
    name: "Everyday",
    currency: "PLN",
    createdAt: now,
    updatedAt: now,
  });

  const inserted: { id: string; bookingDate: string }[] = [];
  for (const [index, booking] of bookings.entries()) {
    const id = crypto.randomUUID();
    // oxlint-disable-next-line eslint/no-await-in-loop -- keeps seeded ids deterministic in order
    await db.insert(transactions).values({
      id,
      userId: user.id,
      bankAccountId,
      sourceExternalId: `seed-${index}`,
      bookingDate: booking.bookingDate,
      amountMinor: booking.amountMinor,
      currency: "PLN",
      creditDebit: "CRDT",
      description: "Salary",
      counterpartyName: booking.counterpartyName,
      createdAt: now,
      updatedAt: now,
    });
    inserted.push({ id, bookingDate: booking.bookingDate });
  }

  return { cookie, userId: user.id, bankAccountId, transactions: inserted };
}

describe("recurring series routes", () => {
  beforeEach(async () => {
    await resetAuthState();
  });

  it("denies unauthenticated access", async () => {
    const list = await app.request("/recurring-series", undefined, env);
    const occurrences = await app.request("/recurring-occurrences", undefined, env);

    expect(list.status).toBe(401);
    expect(occurrences.status).toBe(401);
  });

  it("creates a series from a transaction and projects matched occurrences", async () => {
    const seed = await seedLedger("operator@numra.test", [
      { bookingDate: "2026-01-02", amountMinor: 720_000, counterpartyName: "Acme Software" },
      { bookingDate: "2026-02-02", amountMinor: 720_000, counterpartyName: "Acme Software" },
      { bookingDate: "2026-03-03", amountMinor: 760_000, counterpartyName: "Acme Software" },
    ]);

    const createResponse = await authedRequest("/recurring-series", seed.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionId: seed.transactions[0]!.id,
        cadence: "monthly",
        endDate: "2026-05-31",
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = seriesSchema.parse((await createResponse.json<{ series: unknown }>()).series);
    expect(created).toMatchObject({
      kind: "income",
      cadence: "monthly",
      label: "Acme Software",
      counterpartyName: "Acme Software",
      expectedAmountMinor: 720_000,
      startDate: "2026-01-02",
      endDate: "2026-05-31",
    });

    const listResponse = await authedRequest("/recurring-series?kind=income", seed.cookie);
    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      series: [{ id: created.id, accountName: "Everyday" }],
    });

    const occurrencesResponse = await authedRequest(
      "/recurring-occurrences?from=2026-01-01&to=2026-06-30",
      seed.cookie,
    );
    expect(occurrencesResponse.status).toBe(200);
    const body = occurrencesSchema.parse(await occurrencesResponse.json());

    // Jan/Feb/Mar match real transactions; Apr/May project forward; June is past endDate.
    expect(body.occurrences.map((item) => item.expectedDate)).toEqual([
      "2026-01-02",
      "2026-02-02",
      "2026-03-02",
      "2026-04-02",
      "2026-05-02",
    ]);
    expect(body.occurrences.slice(0, 3).every((item) => item.status === "received")).toBe(true);
    expect(body.occurrences[2]?.transaction?.amountMinor).toBe(760_000);
    expect(body.occurrences.slice(3).every((item) => item.transaction === null)).toBe(true);

    // Received uses actual amounts (720k + 720k + 760k); the rest use the expected amount.
    expect(body.totals).toEqual([
      {
        currency: "PLN",
        receivedMinor: 2_200_000,
        outstandingMinor: 1_440_000,
        projectedMinor: 3_640_000,
      },
    ]);
  });

  it("defaults the occurrence range to the current month", async () => {
    const seed = await seedLedger("month@numra.test", [
      { bookingDate: "2026-01-02", amountMinor: 500_000, counterpartyName: "Acme Software" },
    ]);

    await authedRequest("/recurring-series", seed.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionId: seed.transactions[0]!.id, cadence: "monthly" }),
    });

    const response = await authedRequest("/recurring-occurrences", seed.cookie);
    const body = occurrencesSchema.parse(await response.json());
    const today = new Date().toISOString().slice(0, 10);

    expect(body.range.from.slice(0, 7)).toBe(today.slice(0, 7));
    expect(body.range.to.slice(0, 7)).toBe(today.slice(0, 7));
  });

  it("updates and deletes a series", async () => {
    const seed = await seedLedger("edit@numra.test", [
      { bookingDate: "2026-01-02", amountMinor: 500_000, counterpartyName: "Acme Software" },
    ]);

    const created = seriesSchema.parse(
      (
        await (
          await authedRequest("/recurring-series", seed.cookie, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ transactionId: seed.transactions[0]!.id, cadence: "monthly" }),
          })
        ).json<{ series: unknown }>()
      ).series,
    );

    const patchResponse = await authedRequest(`/recurring-series/${created.id}`, seed.cookie, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "Contract — Acme", endDate: "2026-09-30" }),
    });

    expect(patchResponse.status).toBe(200);
    await expect(patchResponse.json()).resolves.toMatchObject({
      series: { label: "Contract — Acme", endDate: "2026-09-30" },
    });

    const clearEndDate = await authedRequest(`/recurring-series/${created.id}`, seed.cookie, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endDate: null }),
    });
    await expect(clearEndDate.json()).resolves.toMatchObject({ series: { endDate: null } });

    const deleteResponse = await authedRequest(`/recurring-series/${created.id}`, seed.cookie, {
      method: "DELETE",
    });
    expect(deleteResponse.status).toBe(200);

    await expect((await authedRequest("/recurring-series", seed.cookie)).json()).resolves.toEqual({
      series: [],
    });
  });

  it("rejects an end date before the start date", async () => {
    const seed = await seedLedger("invalid@numra.test", [
      { bookingDate: "2026-05-02", amountMinor: 500_000, counterpartyName: "Acme Software" },
    ]);

    const response = await authedRequest("/recurring-series", seed.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transactionId: seed.transactions[0]!.id,
        cadence: "monthly",
        endDate: "2026-01-01",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "invalid_date_range" });
  });

  it("does not create a series from another user's transaction", async () => {
    const owner = await seedLedger("owner@numra.test", [
      { bookingDate: "2026-01-02", amountMinor: 500_000, counterpartyName: "Acme Software" },
    ]);
    const stranger = await seedLedger("stranger@numra.test", []);

    const response = await authedRequest("/recurring-series", stranger.cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactionId: owner.transactions[0]!.id, cadence: "monthly" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "transaction_not_found" });
  });
});
