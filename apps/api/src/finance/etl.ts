import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { bankAccounts, connections, transactions } from "../db/schema.ts";
import {
  EnableBankingApiError,
  type EnableBankingBalance,
  type EnableBankingClient,
} from "../enable-banking/index.ts";
import type { Env } from "../env.ts";
import { decryptSecret } from "./crypto.ts";
import { amountToMinorUnits } from "./money.ts";
import { normalizeTransaction } from "./normalize.ts";

export type EtlResult = {
  connectionsProcessed: number;
  transactionsUpserted: number;
  errors: Array<{ connectionId: string; message: string }>;
  balanceErrors: Array<{ connectionId: string; accountId: string; message: string }>;
};

const DEFAULT_LOOKBACK_DAYS = 90;

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Shared ETL path used by the hourly workflow and post-connect sync.
 * When connectionId is set, only that connection is synced.
 *
 * Connection/account/page loops are intentionally sequential: provider rate
 * limits and per-connection error isolation matter more than parallel speed
 * at personal scale.
 */
export async function runLedgerEtl(input: {
  db: Db;
  env: Env;
  client: EnableBankingClient;
  connectionId?: string;
  lookbackDays?: number;
}): Promise<EtlResult> {
  const { db, env, client } = input;
  const lookbackDays = input.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const dateFrom = isoDateDaysAgo(lookbackDays);

  const rows = input.connectionId
    ? await db.select().from(connections).where(eq(connections.id, input.connectionId)).all()
    : await db
        .select()
        .from(connections)
        .where(inArray(connections.status, ["active", "error"]))
        .all();

  const result: EtlResult = {
    connectionsProcessed: 0,
    transactionsUpserted: 0,
    errors: [],
    balanceErrors: [],
  };

  for (const connection of rows) {
    if (connection.status === "pending" || connection.status === "expired") {
      continue;
    }

    if (!connection.sessionIdEncrypted) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
      await markConnectionError(db, connection.id, "Missing provider session.");
      result.errors.push({
        connectionId: connection.id,
        message: "Missing provider session.",
      });
      continue;
    }

    result.connectionsProcessed += 1;

    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
      const sessionId = await decryptSecret(connection.sessionIdEncrypted, env.ENCRYPTION_KEY);
      // session id is stored for potential future GET /sessions calls;
      // account pulls use provider account uids bound to the session.
      void sessionId;

      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
      const accounts = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.connectionId, connection.id))
        .all();

      let upserted = 0;

      for (const account of accounts) {
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per account
          await refreshAccountBalance({ db, client, account });
        } catch (error) {
          // A balance failure must not block transaction ingestion. Retain the previous balance.
          result.balanceErrors.push({
            connectionId: connection.id,
            accountId: account.id,
            message: error instanceof Error ? error.message : "Unknown balance sync error",
          });
        }

        // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per account
        upserted += await pullAccountTransactions({
          db,
          client,
          userId: connection.userId,
          bankAccountId: account.id,
          providerAccountId: account.providerAccountId,
          dateFrom,
        });
      }

      result.transactionsUpserted += upserted;

      // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
      await db
        .update(connections)
        .set({
          status: "active",
          lastSyncedAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(connections.id, connection.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown sync error";
      const expired = error instanceof EnableBankingApiError && error.isSessionExpired;

      if (expired) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
        await db
          .update(connections)
          .set({
            status: "expired",
            lastError: message,
            updatedAt: new Date(),
          })
          .where(eq(connections.id, connection.id));
      } else {
        // oxlint-disable-next-line eslint/no-await-in-loop -- sequential per connection
        await markConnectionError(db, connection.id, message);
      }

      result.errors.push({ connectionId: connection.id, message });
    }
  }

  return result;
}

async function markConnectionError(db: Db, connectionId: string, message: string) {
  await db
    .update(connections)
    .set({
      status: "error",
      lastError: message,
      updatedAt: new Date(),
    })
    .where(eq(connections.id, connectionId));
}

const BALANCE_TYPE_PRIORITY = ["CLBD", "ITAV"] as const;

function selectPreferredBalance(
  balances: EnableBankingBalance[],
): EnableBankingBalance | undefined {
  for (const type of BALANCE_TYPE_PRIORITY) {
    const match = balances.find((balance) => balance.balance_type === type);
    if (match) {
      return match;
    }
  }
  return balances[0];
}

async function refreshAccountBalance(input: {
  db: Db;
  client: EnableBankingClient;
  account: typeof bankAccounts.$inferSelect;
}): Promise<void> {
  const response = await input.client.getBalances({
    accountId: input.account.providerAccountId,
  });
  const balance = selectPreferredBalance(response.balances);
  if (!balance) {
    return;
  }

  const now = new Date();
  await input.db
    .update(bankAccounts)
    .set({
      balanceMinor: amountToMinorUnits(balance.balance_amount.amount),
      balanceCurrency: balance.balance_amount.currency,
      balanceType: balance.balance_type,
      balanceAsOf: balance.last_change_date_time ?? balance.reference_date ?? null,
      balanceSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(bankAccounts.id, input.account.id));
}

async function pullAccountTransactions(input: {
  db: Db;
  client: EnableBankingClient;
  userId: string;
  bankAccountId: string;
  providerAccountId: string;
  dateFrom: string;
}): Promise<number> {
  let continuationKey: string | undefined;
  let upserted = 0;

  do {
    const request = {
      accountId: input.providerAccountId,
      dateFrom: input.dateFrom,
      ...(continuationKey !== undefined ? { continuationKey } : {}),
    };
    // oxlint-disable-next-line eslint/no-await-in-loop -- pagination must be sequential
    const page = await input.client.getTransactions(request);

    for (const raw of page.transactions) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- normalize then upsert per row
      const normalized = await normalizeTransaction(raw);
      const now = new Date();
      const id = crypto.randomUUID();

      // oxlint-disable-next-line eslint/no-await-in-loop -- D1 upsert per transaction
      await input.db
        .insert(transactions)
        .values({
          id,
          userId: input.userId,
          bankAccountId: input.bankAccountId,
          sourceExternalId: normalized.sourceExternalId,
          bookingDate: normalized.bookingDate,
          valueDate: normalized.valueDate,
          amountMinor: normalized.amountMinor,
          currency: normalized.currency,
          creditDebit: normalized.creditDebit,
          description: normalized.description,
          counterpartyName: normalized.counterpartyName,
          rawPayload: normalized.rawPayload,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [transactions.bankAccountId, transactions.sourceExternalId],
          set: {
            bookingDate: normalized.bookingDate,
            valueDate: normalized.valueDate,
            amountMinor: normalized.amountMinor,
            currency: normalized.currency,
            creditDebit: normalized.creditDebit,
            description: normalized.description,
            counterpartyName: normalized.counterpartyName,
            rawPayload: normalized.rawPayload,
            updatedAt: now,
          },
        });

      upserted += 1;
    }

    continuationKey = page.continuation_key ?? undefined;
  } while (continuationKey);

  return upserted;
}

/** Convenience: load active connection ids for a user (authz helper). */
export async function assertConnectionOwnedByUser(
  db: Db,
  connectionId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.id, connectionId), eq(connections.userId, userId)))
    .get();

  return row !== undefined;
}
