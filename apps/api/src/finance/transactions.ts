import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { bankAccounts, transactions } from "../db/schema.ts";

export async function listTransactionsForUser(
  db: Db,
  userId: string,
  options: { accountId?: string; limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const filters = [eq(transactions.userId, userId)];
  if (options.accountId) {
    filters.push(eq(transactions.bankAccountId, options.accountId));
  }

  const rows = await db
    .select({
      id: transactions.id,
      bankAccountId: transactions.bankAccountId,
      accountName: bankAccounts.name,
      accountCurrency: bankAccounts.currency,
      bookingDate: transactions.bookingDate,
      valueDate: transactions.valueDate,
      amountMinor: transactions.amountMinor,
      currency: transactions.currency,
      creditDebit: transactions.creditDebit,
      description: transactions.description,
      counterpartyName: transactions.counterpartyName,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(bankAccounts, eq(transactions.bankAccountId, bankAccounts.id))
    .where(and(...filters))
    .orderBy(desc(transactions.bookingDate), desc(transactions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const countRow = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(transactions)
    .where(and(...filters))
    .get();

  const total = countRow?.count ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      bankAccountId: row.bankAccountId,
      accountName: row.accountName,
      bookingDate: row.bookingDate,
      valueDate: row.valueDate,
      amountMinor: row.amountMinor,
      /** Signed minor units: credits positive, debits negative for display convenience. */
      signedAmountMinor:
        row.creditDebit === "DBIT" ? -Math.abs(row.amountMinor) : Math.abs(row.amountMinor),
      currency: row.currency,
      creditDebit: row.creditDebit,
      description: row.description,
      counterpartyName: row.counterpartyName,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      limit,
      offset,
      total,
    },
  };
}
