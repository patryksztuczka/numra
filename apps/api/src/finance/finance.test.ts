import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { app } from "../app.ts";
import { createDb } from "../db/index.ts";
import { connections, transactions } from "../db/schema.ts";
import { setEnableBankingClientFactory } from "../enable-banking/index.ts";
import { EnableBankingApiError } from "../enable-banking/types.ts";
import { createFakeEnableBankingClient } from "../test/fake-enable-banking.ts";
import { allowEmail, cookieHeaderFromResponse, resetAuthState, testEnv } from "../test/fixtures.ts";
import { runLedgerEtl } from "./etl.ts";

const password = "correct-horse-battery-staple";

const startBodySchema = z.object({
  redirectUrl: z.string(),
  connectionId: z.string(),
});

const connectionsBodySchema = z.object({
  connections: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      aspspName: z.string(),
      lastError: z.string().nullable().optional(),
    }),
  ),
});

const accountsBodySchema = z.object({
  accounts: z.array(
    z.object({
      id: z.string(),
      currency: z.string().optional(),
      ibanMasked: z.string().nullable().optional(),
    }),
  ),
});

const transactionsBodySchema = z.object({
  items: z.array(
    z.object({
      bankAccountId: z.string().optional(),
      description: z.string().nullable().optional(),
      amountMinor: z.number().optional(),
    }),
  ),
  pagination: z.object({
    total: z.number(),
  }),
});

async function signUp(email: string, name = "Numra User") {
  return app.request(
    "/api/auth/sign-up/email",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email, password, name }),
    },
    env,
  );
}

async function authedRequest(path: string, cookie: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (!headers.has("origin")) {
    headers.set("origin", "http://localhost:5173");
  }

  return app.request(
    path,
    {
      ...init,
      headers,
    },
    env,
  );
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("finance ledger", () => {
  beforeEach(async () => {
    await resetAuthState();
    setEnableBankingClientFactory(() => createFakeEnableBankingClient());
  });

  afterEach(() => {
    setEnableBankingClientFactory(null);
  });

  it("denies unauthenticated access to finance routes", async () => {
    const connectionsResponse = await app.request("/connections", undefined, env);
    const accountsResponse = await app.request("/accounts", undefined, env);
    const transactionsResponse = await app.request("/transactions", undefined, env);

    for (const response of [connectionsResponse, accountsResponse, transactionsResponse]) {
      expect(response.status).toBe(401);
    }

    await expect(connectionsResponse.json()).resolves.toMatchObject({ error: "unauthorized" });
    await expect(accountsResponse.json()).resolves.toMatchObject({ error: "unauthorized" });
    await expect(transactionsResponse.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("returns empty lists for a fresh signed-in user", async () => {
    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    const connectionsResponse = await authedRequest("/connections", cookie);
    expect(connectionsResponse.status).toBe(200);
    await expect(connectionsResponse.json()).resolves.toEqual({ connections: [] });

    const accountsResponse = await authedRequest("/accounts", cookie);
    expect(accountsResponse.status).toBe(200);
    await expect(accountsResponse.json()).resolves.toEqual({ accounts: [] });

    const transactionsResponse = await authedRequest("/transactions", cookie);
    expect(transactionsResponse.status).toBe(200);
    await expect(transactionsResponse.json()).resolves.toMatchObject({
      items: [],
      pagination: { total: 0 },
    });
  });

  it("completes connect callback, stores connection + accounts, and ETL upserts transactions", async () => {
    const fake = createFakeEnableBankingClient();
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    const startResponse = await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });

    expect(startResponse.status).toBe(200);
    const startBody = startBodySchema.parse(await readJson(startResponse));
    expect(startBody.redirectUrl).toContain("https://auth.enablebanking.com/");
    expect(fake.started).toHaveLength(1);

    const state = fake.started[0]!.state;

    const callbackResponse = await app.request(
      `/connections/enable-banking/callback?code=auth-code-1&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    expect(callbackResponse.status).toBeGreaterThanOrEqual(300);
    expect(callbackResponse.status).toBeLessThan(400);
    const location = callbackResponse.headers.get("location") ?? "";
    expect(location).toContain("/connections?");
    expect(location).toContain("connect=success");

    const connectionsResponse = await authedRequest("/connections", cookie);
    const connectionsBody = connectionsBodySchema.parse(await readJson(connectionsResponse));
    expect(connectionsBody.connections).toHaveLength(1);
    expect(connectionsBody.connections[0]).toMatchObject({
      status: "active",
      aspspName: "PKO BP",
    });

    const accountsResponse = await authedRequest("/accounts", cookie);
    const accountsBody = accountsBodySchema.parse(await readJson(accountsResponse));
    expect(accountsBody.accounts).toHaveLength(2);
    expect(accountsBody.accounts[0]?.ibanMasked).toMatch(/••••/);

    const transactionsResponse = await authedRequest("/transactions", cookie);
    expect(transactionsResponse.status).toBe(200);
    const txBody = transactionsBodySchema.parse(await readJson(transactionsResponse));
    expect(txBody.pagination.total).toBeGreaterThanOrEqual(3);
    expect(txBody.items.some((item) => item.description?.includes("Coffee"))).toBe(true);
  });

  it("does not duplicate transactions on a second ETL sync", async () => {
    const fake = createFakeEnableBankingClient();
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });

    const state = fake.started[0]!.state;
    await app.request(
      `/connections/enable-banking/callback?code=auth-code-dup&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    const db = createDb(testEnv());
    const connection = await db.select().from(connections).get();
    expect(connection).toBeTruthy();

    const first = await runLedgerEtl({
      db,
      env: testEnv(),
      client: fake,
      connectionId: connection!.id,
    });
    const second = await runLedgerEtl({
      db,
      env: testEnv(),
      client: fake,
      connectionId: connection!.id,
    });

    expect(first.transactionsUpserted).toBeGreaterThan(0);
    expect(second.transactionsUpserted).toBe(first.transactionsUpserted);

    const all = await db.select().from(transactions).all();
    const uniqueKeys = new Set(all.map((row) => `${row.bankAccountId}:${row.sourceExternalId}`));
    expect(uniqueKeys.size).toBe(all.length);

    const list = await authedRequest("/transactions", cookie);
    const body = transactionsBodySchema.parse(await readJson(list));
    expect(body.pagination.total).toBe(all.length);
  });

  it("marks the connection expired when the provider session is expired", async () => {
    const fake = createFakeEnableBankingClient({ expireOnTransactions: true });
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "Revolut", aspspCountry: "LT" }),
    });

    const state = fake.started[0]!.state;
    await app.request(
      `/connections/enable-banking/callback?code=auth-code-exp&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    const list = await authedRequest("/connections", cookie);
    const body = connectionsBodySchema.parse(await readJson(list));

    expect(body.connections[0]?.status).toBe("expired");
    expect(body.connections[0]?.lastError).toMatch(/expired/i);
  });

  it("marks the connection as error on non-expiry provider failures", async () => {
    const fake = createFakeEnableBankingClient({
      transactionsError: new EnableBankingApiError("ASPSP unavailable", 500, "ASPSP_ERROR"),
    });
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });
    const state = fake.started[0]!.state;
    await app.request(
      `/connections/enable-banking/callback?code=auth-code-err&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    const list = await authedRequest("/connections", cookie);
    const body = connectionsBodySchema.parse(await readJson(list));
    expect(body.connections[0]?.status).toBe("error");
    expect(body.connections[0]?.lastError).toMatch(/unavailable/i);
  });

  it("scopes finance data to the signed-in user", async () => {
    const fake = createFakeEnableBankingClient();
    setEnableBankingClientFactory(() => fake);

    await allowEmail("alice@numra.test");
    await allowEmail("bob@numra.test");

    const aliceSignUp = await signUp("alice@numra.test", "Alice");
    const aliceCookie = cookieHeaderFromResponse(aliceSignUp);

    await authedRequest("/connections/enable-banking/start", aliceCookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });
    const state = fake.started[0]!.state;
    await app.request(
      `/connections/enable-banking/callback?code=alice-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    const bobSignUp = await signUp("bob@numra.test", "Bob");
    const bobCookie = cookieHeaderFromResponse(bobSignUp);

    const bobConnections = await authedRequest("/connections", bobCookie);
    await expect(bobConnections.json()).resolves.toEqual({ connections: [] });

    const bobAccounts = await authedRequest("/accounts", bobCookie);
    await expect(bobAccounts.json()).resolves.toEqual({ accounts: [] });

    const bobTx = await authedRequest("/transactions", bobCookie);
    await expect(bobTx.json()).resolves.toMatchObject({
      items: [],
      pagination: { total: 0 },
    });

    const aliceConnections = await authedRequest("/connections", aliceCookie);
    const aliceBody = connectionsBodySchema.parse(await readJson(aliceConnections));
    expect(aliceBody.connections).toHaveLength(1);
  });

  it("filters transactions by accountId", async () => {
    const fake = createFakeEnableBankingClient();
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });
    const state = fake.started[0]!.state;
    await app.request(
      `/connections/enable-banking/callback?code=filter-code&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    const accountsResponse = await authedRequest("/accounts", cookie);
    const accountsBody = accountsBodySchema.parse(await readJson(accountsResponse));
    const accountId = accountsBody.accounts[0]!.id;

    const filtered = await authedRequest(
      `/transactions?accountId=${encodeURIComponent(accountId)}`,
      cookie,
    );
    const body = transactionsBodySchema.parse(await readJson(filtered));

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((item) => item.bankAccountId === accountId)).toBe(true);
  });

  it("redirects with error when consent is cancelled", async () => {
    const fake = createFakeEnableBankingClient();
    setEnableBankingClientFactory(() => fake);

    await allowEmail("operator@numra.test");
    const signUpResponse = await signUp("operator@numra.test");
    const cookie = cookieHeaderFromResponse(signUpResponse);

    await authedRequest("/connections/enable-banking/start", cookie, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aspspName: "PKO BP", aspspCountry: "PL" }),
    });
    const state = fake.started[0]!.state;

    const response = await app.request(
      `/connections/enable-banking/callback?error=access_denied&error_description=${encodeURIComponent(
        "Cancelled by user",
      )}&state=${encodeURIComponent(state)}`,
      { redirect: "manual" },
      env,
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("connect=error");
    expect(location).toContain("Cancelled");

    const list = await authedRequest("/connections", cookie);
    const body = connectionsBodySchema.parse(await readJson(list));
    expect(body.connections[0]?.status).toBe("error");
  });
});
