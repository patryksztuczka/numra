import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { bankAccounts, connections } from "../db/schema.ts";
import { getEnableBankingClient } from "../enable-banking/index.ts";
import type { Env } from "../env.ts";
import { encryptSecret } from "./crypto.ts";
import { maskIban } from "./normalize.ts";

export const SUPPORTED_ASPSPS = [
  { name: "PKO BP", country: "PL", label: "PKO BP" },
  { name: "Revolut", country: "LT", label: "Revolut" },
] as const;

export type SupportedAspsp = (typeof SUPPORTED_ASPSPS)[number];

function consentValidUntilIso(): string {
  // 90 days ahead — within typical PSD2 max consent windows.
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 90);
  return date.toISOString().replace(/\.\d{3}Z$/, ".000000+00:00");
}

export async function startEnableBankingConnect(input: {
  db: Db;
  env: Env;
  userId: string;
  aspspName: string;
  aspspCountry: string;
}): Promise<{ redirectUrl: string; connectionId: string }> {
  const supported = SUPPORTED_ASPSPS.find(
    (item) =>
      item.name.toLowerCase() === input.aspspName.toLowerCase() &&
      item.country.toLowerCase() === input.aspspCountry.toLowerCase(),
  );

  if (!supported) {
    throw new ConnectError(
      "unsupported_aspsp",
      "Only PKO BP (PL) and Revolut (LT) are supported in this version.",
    );
  }

  const connectionId = crypto.randomUUID();
  const authState = crypto.randomUUID();
  const now = new Date();

  await input.db.insert(connections).values({
    id: connectionId,
    userId: input.userId,
    provider: "enable_banking",
    status: "pending",
    aspspName: supported.name,
    aspspCountry: supported.country,
    authState,
    sessionIdEncrypted: null,
    validUntil: null,
    lastSyncedAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  });

  const client = getEnableBankingClient(input.env);
  const auth = await client.startAuthorization({
    aspsp: { name: supported.name, country: supported.country },
    state: authState,
    redirectUrl: input.env.ENABLE_BANKING_REDIRECT_URL,
    validUntil: consentValidUntilIso(),
    psuType: "personal",
  });

  return { redirectUrl: auth.url, connectionId };
}

export async function completeEnableBankingConnect(input: {
  db: Db;
  env: Env;
  code: string;
  state: string;
}): Promise<{ connectionId: string; userId: string }> {
  const pending = await input.db
    .select()
    .from(connections)
    .where(and(eq(connections.authState, input.state), eq(connections.status, "pending")))
    .get();

  if (!pending) {
    throw new ConnectError(
      "invalid_state",
      "No pending connection matches this authorization state.",
    );
  }

  const client = getEnableBankingClient(input.env);
  const session = await client.createSession(input.code);
  const sessionEncrypted = await encryptSecret(session.session_id, input.env.ENCRYPTION_KEY);
  const validUntil = session.access?.valid_until ? new Date(session.access.valid_until) : null;
  const now = new Date();

  await input.db
    .update(connections)
    .set({
      status: "active",
      sessionIdEncrypted: sessionEncrypted,
      validUntil,
      authState: null,
      lastError: null,
      aspspName: session.aspsp?.name ?? pending.aspspName,
      aspspCountry: session.aspsp?.country ?? pending.aspspCountry,
      updatedAt: now,
    })
    .where(eq(connections.id, pending.id));

  // Sequential upserts keep identification_hash uniqueness checks simple.
  for (const account of session.accounts) {
    if (!account.uid || !account.identification_hash) {
      continue;
    }

    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential account upsert
    const existing = await input.db
      .select()
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.userId, pending.userId),
          eq(bankAccounts.identificationHash, account.identification_hash),
        ),
      )
      .get();

    if (existing) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential account upsert
      await input.db
        .update(bankAccounts)
        .set({
          connectionId: pending.id,
          providerAccountId: account.uid,
          name: account.name ?? existing.name,
          currency: account.currency || existing.currency,
          iban: account.account_id?.iban ?? existing.iban,
          updatedAt: now,
        })
        .where(eq(bankAccounts.id, existing.id));
    } else {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential account upsert
      await input.db.insert(bankAccounts).values({
        id: crypto.randomUUID(),
        userId: pending.userId,
        connectionId: pending.id,
        providerAccountId: account.uid,
        identificationHash: account.identification_hash,
        name: account.name ?? null,
        currency: account.currency || "EUR",
        iban: account.account_id?.iban ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return { connectionId: pending.id, userId: pending.userId };
}

export async function markConnectFailed(input: {
  db: Db;
  state: string | undefined;
  message: string;
}) {
  if (!input.state) {
    return;
  }

  await input.db
    .update(connections)
    .set({
      status: "error",
      lastError: input.message,
      authState: null,
      updatedAt: new Date(),
    })
    .where(and(eq(connections.authState, input.state), eq(connections.status, "pending")));
}

export async function listConnectionsForUser(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(connections)
    .where(eq(connections.userId, userId))
    .orderBy(desc(connections.createdAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    aspspName: row.aspspName,
    aspspCountry: row.aspspCountry,
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listBankAccountsForUser(db: Db, userId: string) {
  const rows = await db
    .select({
      id: bankAccounts.id,
      connectionId: bankAccounts.connectionId,
      name: bankAccounts.name,
      currency: bankAccounts.currency,
      iban: bankAccounts.iban,
      aspspName: connections.aspspName,
      aspspCountry: connections.aspspCountry,
      createdAt: bankAccounts.createdAt,
    })
    .from(bankAccounts)
    .innerJoin(connections, eq(bankAccounts.connectionId, connections.id))
    .where(eq(bankAccounts.userId, userId))
    .orderBy(desc(bankAccounts.createdAt))
    .all();

  return rows.map((row) => ({
    id: row.id,
    connectionId: row.connectionId,
    name: row.name,
    currency: row.currency,
    ibanMasked: maskIban(row.iban),
    aspspName: row.aspspName,
    aspspCountry: row.aspspCountry,
    createdAt: row.createdAt.toISOString(),
  }));
}

export class ConnectError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ConnectError";
    this.code = code;
  }
}
