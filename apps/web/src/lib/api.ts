import { z } from "zod";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const errorBodySchema = z
  .object({
    message: z.string().optional(),
  })
  .passthrough();

function nullWhenMissing<T>(value: T | null | undefined): T | null {
  return value ?? null;
}

const connectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  status: z.string(),
  aspspName: z.string(),
  aspspCountry: z.string(),
  validUntil: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
});

const bankAccountSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  providerName: z.string().nullable(),
  customName: z.string().nullable(),
  displayName: z.string(),
  currency: z.string(),
  ibanMasked: z.string().nullable(),
  balanceMinor: z.number().nullish().transform(nullWhenMissing),
  balanceCurrency: z.string().nullish().transform(nullWhenMissing),
  balanceType: z.string().nullish().transform(nullWhenMissing),
  balanceAsOf: z.string().nullish().transform(nullWhenMissing),
  balanceSyncedAt: z.string().nullish().transform(nullWhenMissing),
  aspspName: z.string(),
  aspspCountry: z.string(),
  createdAt: z.string(),
});

const transactionSchema = z.object({
  id: z.string(),
  bankAccountId: z.string(),
  accountName: z.string().nullable(),
  bookingDate: z.string(),
  valueDate: z.string().nullable(),
  amountMinor: z.number(),
  signedAmountMinor: z.number(),
  currency: z.string(),
  creditDebit: z.string(),
  description: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  createdAt: z.string(),
});

const aspspSchema = z.object({
  name: z.string(),
  country: z.string(),
  label: z.string(),
});

export const CADENCES = ["monthly", "biweekly", "weekly", "quarterly"] as const;
export type Cadence = (typeof CADENCES)[number];

export const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Every month",
  biweekly: "Every two weeks",
  weekly: "Every week",
  quarterly: "Every quarter",
};

const recurringSeriesSchema = z.object({
  id: z.string(),
  bankAccountId: z.string(),
  seedTransactionId: z.string().nullable(),
  kind: z.string(),
  label: z.string(),
  counterpartyName: z.string().nullable(),
  expectedAmountMinor: z.number(),
  currency: z.string(),
  cadence: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  accountName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const occurrenceSchema = z.object({
  seriesId: z.string(),
  label: z.string(),
  kind: z.string(),
  currency: z.string(),
  counterpartyName: z.string().nullable(),
  bankAccountId: z.string(),
  expectedDate: z.string(),
  expectedAmountMinor: z.number(),
  status: z.enum(["received", "expected", "late"]),
  transaction: z
    .object({
      id: z.string(),
      bookingDate: z.string(),
      amountMinor: z.number(),
      currency: z.string(),
      description: z.string().nullable(),
    })
    .nullable(),
});

const recurringSeriesResponseSchema = z.object({
  series: z.array(recurringSeriesSchema),
});

const createSeriesResponseSchema = z.object({
  series: recurringSeriesSchema,
});

const occurrencesResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string() }),
  occurrences: z.array(occurrenceSchema),
  totals: z.array(
    z.object({
      currency: z.string(),
      receivedMinor: z.number(),
      outstandingMinor: z.number(),
      projectedMinor: z.number(),
    }),
  ),
});

export type RecurringSeries = z.infer<typeof recurringSeriesSchema>;
export type RecurringOccurrence = z.infer<typeof occurrenceSchema>;
export type OccurrencesResult = z.infer<typeof occurrencesResponseSchema>;

const connectionsResponseSchema = z.object({
  connections: z.array(connectionSchema),
});

const accountsResponseSchema = z.object({
  accounts: z.array(bankAccountSchema),
});

const transactionsResponseSchema = z.object({
  items: z.array(transactionSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    total: z.number(),
  }),
});

const aspspsResponseSchema = z.object({
  aspsps: z.array(aspspSchema),
});

const startConnectResponseSchema = z.object({
  redirectUrl: z.string(),
  connectionId: z.string(),
});

export type Connection = z.infer<typeof connectionSchema>;
export type BankAccount = z.infer<typeof bankAccountSchema>;
export type LedgerTransaction = z.infer<typeof transactionSchema>;
export type AspspOption = z.infer<typeof aspspSchema>;

async function apiFetch(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<unknown> {
  const headers = new Headers();
  headers.set("content-type", "application/json");

  const requestInit: RequestInit = {
    credentials: "include",
    headers,
  };
  if (init.method !== undefined) {
    requestInit.method = init.method;
  }
  if (init.body !== undefined) {
    requestInit.body = init.body;
  }

  const response = await fetch(`${apiUrl}${path}`, requestInit);

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const parsed = errorBodySchema.safeParse(await response.json());
      if (parsed.success && parsed.data.message) {
        message = parsed.data.message;
      }
    } catch {
      // keep default
    }
    throw new ApiError(response.status, message);
  }

  return response.json();
}

export async function fetchConnections() {
  return connectionsResponseSchema.parse(await apiFetch("/connections"));
}

export async function fetchAccounts() {
  return accountsResponseSchema.parse(await apiFetch("/accounts"));
}

export async function saveAccountOrder(accountIds: string[]): Promise<void> {
  await apiFetch("/accounts/order", {
    method: "PATCH",
    body: JSON.stringify({ accountIds }),
  });
}

export async function saveAccountCustomName(
  accountId: string,
  customName: string | null,
): Promise<void> {
  await apiFetch(`/accounts/${encodeURIComponent(accountId)}`, {
    method: "PATCH",
    body: JSON.stringify({ customName }),
  });
}

export async function fetchTransactions(params?: {
  accountId?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params?.accountId) {
    search.set("accountId", params.accountId);
  }
  if (params?.limit !== undefined) {
    search.set("limit", String(params.limit));
  }
  if (params?.offset !== undefined) {
    search.set("offset", String(params.offset));
  }
  const query = search.toString();
  return transactionsResponseSchema.parse(
    await apiFetch(`/transactions${query ? `?${query}` : ""}`),
  );
}

export async function fetchAspsps() {
  return aspspsResponseSchema.parse(await apiFetch("/connections/aspsps"));
}

export async function fetchRecurringSeries(kind?: "income" | "expense") {
  const query = kind ? `?kind=${kind}` : "";
  return recurringSeriesResponseSchema.parse(await apiFetch(`/recurring-series${query}`));
}

export async function createRecurringSeries(input: {
  transactionId: string;
  cadence: Cadence;
  label?: string;
  expectedAmountMinor?: number;
  endDate?: string | null;
}) {
  return createSeriesResponseSchema.parse(
    await apiFetch("/recurring-series", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function updateRecurringSeries(
  seriesId: string,
  patch: {
    label?: string;
    expectedAmountMinor?: number;
    cadence?: Cadence;
    startDate?: string;
    endDate?: string | null;
  },
) {
  return createSeriesResponseSchema.parse(
    await apiFetch(`/recurring-series/${encodeURIComponent(seriesId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  );
}

export async function deleteRecurringSeries(seriesId: string): Promise<void> {
  await apiFetch(`/recurring-series/${encodeURIComponent(seriesId)}`, { method: "DELETE" });
}

export async function fetchRecurringOccurrences(params?: {
  from?: string;
  to?: string;
  kind?: "income" | "expense";
}) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.kind) search.set("kind", params.kind);
  const query = search.toString();
  return occurrencesResponseSchema.parse(
    await apiFetch(`/recurring-occurrences${query ? `?${query}` : ""}`),
  );
}

export async function startBankConnect(aspspName: string, aspspCountry: string) {
  return startConnectResponseSchema.parse(
    await apiFetch("/connections/enable-banking/start", {
      method: "POST",
      body: JSON.stringify({ aspspName, aspspCountry }),
    }),
  );
}

/** Format signed minor units for UI. */
export function formatMoney(signedMinor: number, currency: string): string {
  const sign = signedMinor < 0 ? "-" : signedMinor > 0 ? "+" : "";
  const abs = Math.abs(signedMinor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${fraction} ${currency}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(value.length === 10 ? `${value}T00:00:00Z` : value),
    );
  } catch {
    return value;
  }
}
