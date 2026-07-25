import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp_ms",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp_ms",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const allowedEmails = sqliteTable("allowed_emails", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

/** Linked bank institution authorization (Enable Banking session). */
export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("enable_banking"),
    status: text("status").notNull().default("pending"),
    aspspName: text("aspsp_name").notNull(),
    aspspCountry: text("aspsp_country").notNull(),
    /** OAuth state used during consent start/callback. */
    authState: text("auth_state"),
    /** Enable Banking session id, encrypted at rest when present. */
    sessionIdEncrypted: text("session_id_encrypted"),
    validUntil: integer("valid_until", { mode: "timestamp_ms" }),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("connections_auth_state_uidx").on(table.authState)],
);

/** Bank account belonging to a connection (Numra ledger). */
export const bankAccounts = sqliteTable(
  "bank_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    /** Enable Banking account uid (session-scoped; may change on re-auth). */
    providerAccountId: text("provider_account_id").notNull(),
    /** Durable cross-session identity from Enable Banking. */
    identificationHash: text("identification_hash").notNull(),
    name: text("name"),
    currency: text("currency").notNull(),
    iban: text("iban"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("bank_accounts_user_identification_hash_uidx").on(
      table.userId,
      table.identificationHash,
    ),
  ],
);

/** Ledger transaction stored in minor units. */
export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankAccountId: text("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    sourceExternalId: text("source_external_id").notNull(),
    bookingDate: text("booking_date").notNull(),
    valueDate: text("value_date"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    creditDebit: text("credit_debit").notNull(),
    description: text("description"),
    counterpartyName: text("counterparty_name"),
    rawPayload: text("raw_payload"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("transactions_account_source_uidx").on(table.bankAccountId, table.sourceExternalId),
  ],
);

export const schema = {
  users,
  sessions,
  accounts,
  verifications,
  allowedEmails,
  connections,
  bankAccounts,
  transactions,
};

export type ConnectionStatus = "pending" | "active" | "error" | "expired";
export type CreditDebit = "CRDT" | "DBIT";
