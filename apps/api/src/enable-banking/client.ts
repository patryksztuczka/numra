import { z } from "zod";

import type { Env } from "../env.ts";
import { createEnableBankingJwt } from "./jwt.ts";
import {
  EnableBankingApiError,
  type EnableBankingClient,
  type EnableBankingSessionResponse,
  type EnableBankingStartAuthResponse,
  type EnableBankingTransaction,
  type EnableBankingTransactionsPage,
} from "./types.ts";

const errorBodySchema = z
  .object({
    message: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

const startAuthResponseSchema = z.object({
  url: z.string(),
  authorization_id: z.string(),
  psu_id_hash: z.string(),
});

const accountSchema = z.object({
  uid: z.string(),
  identification_hash: z.string(),
  name: z.string().nullable().optional(),
  currency: z.string(),
  account_id: z
    .object({
      iban: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  cash_account_type: z.string().optional(),
});

const sessionResponseSchema = z.object({
  session_id: z.string(),
  accounts: z.array(accountSchema),
  aspsp: z.object({
    name: z.string(),
    country: z.string(),
  }),
  psu_type: z.string(),
  access: z.object({
    valid_until: z.string(),
  }),
});

const transactionSchema = z.object({
  entry_reference: z.string().nullable().optional(),
  transaction_id: z.string().nullable().optional(),
  transaction_amount: z.object({
    currency: z.string(),
    amount: z.string(),
  }),
  credit_debit_indicator: z.enum(["CRDT", "DBIT"]),
  status: z.string().optional(),
  booking_date: z.string().nullable().optional(),
  value_date: z.string().nullable().optional(),
  transaction_date: z.string().nullable().optional(),
  remittance_information: z.array(z.string()).nullable().optional(),
  reference_number: z.string().nullable().optional(),
  creditor: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  debtor: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  note: z.string().nullable().optional(),
});

const transactionsPageSchema = z.object({
  transactions: z.array(transactionSchema),
  continuation_key: z.string().nullable().optional(),
});

export function createEnableBankingClient(env: Env): EnableBankingClient {
  const baseUrl = env.ENABLE_BANKING_API_BASE.replace(/\/$/, "");

  async function authHeaders(): Promise<Headers> {
    const jwt = await createEnableBankingJwt({
      applicationId: env.ENABLE_BANKING_APPLICATION_ID,
      privateKeyPem: env.ENABLE_BANKING_PRIVATE_KEY,
    });

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${jwt}`);
    headers.set("Accept", "application/json");
    headers.set("Content-Type", "application/json");
    return headers;
  }

  async function request(
    path: string,
    init: { method?: string; body?: string } = {},
  ): Promise<unknown> {
    const headers = await authHeaders();
    const initOptions: RequestInit = { headers };
    if (init.method !== undefined) {
      initOptions.method = init.method;
    }
    if (init.body !== undefined) {
      initOptions.body = init.body;
    }

    const response = await fetch(`${baseUrl}${path}`, initOptions);

    if (!response.ok) {
      let message = `Enable Banking request failed (${response.status})`;
      let code: string | undefined;

      try {
        const parsed = errorBodySchema.safeParse(await response.json());
        if (parsed.success) {
          if (parsed.data.message) {
            message = parsed.data.message;
          }
          if (parsed.data.error) {
            code = parsed.data.error;
          }
        }
      } catch {
        // keep default message
      }

      throw new EnableBankingApiError(message, response.status, code);
    }

    return response.json();
  }

  return {
    async startAuthorization(input) {
      const body = await request("/auth", {
        method: "POST",
        body: JSON.stringify({
          access: {
            valid_until: input.validUntil,
            balances: true,
            transactions: true,
          },
          aspsp: input.aspsp,
          state: input.state,
          redirect_url: input.redirectUrl,
          psu_type: input.psuType ?? "personal",
        }),
      });

      const parsed = startAuthResponseSchema.parse(body);
      const result: EnableBankingStartAuthResponse = parsed;
      return result;
    },

    async createSession(code) {
      const body = await request("/sessions", {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      const parsed = sessionResponseSchema.parse(body);
      const result: EnableBankingSessionResponse = {
        session_id: parsed.session_id,
        accounts: parsed.accounts.map((account) => {
          const mapped: EnableBankingSessionResponse["accounts"][number] = {
            uid: account.uid,
            identification_hash: account.identification_hash,
            currency: account.currency,
          };
          if (account.name !== undefined) {
            mapped.name = account.name;
          }
          if (account.account_id !== undefined) {
            if (account.account_id === null) {
              mapped.account_id = null;
            } else {
              mapped.account_id = {};
              if (account.account_id.iban !== undefined) {
                mapped.account_id.iban = account.account_id.iban;
              }
            }
          }
          if (account.cash_account_type !== undefined) {
            mapped.cash_account_type = account.cash_account_type;
          }
          return mapped;
        }),
        aspsp: parsed.aspsp,
        psu_type: parsed.psu_type,
        access: parsed.access,
      };
      return result;
    },

    async getTransactions(input) {
      const params = new URLSearchParams();
      if (input.dateFrom) {
        params.set("date_from", input.dateFrom);
      }
      if (input.dateTo) {
        params.set("date_to", input.dateTo);
      }
      if (input.continuationKey) {
        params.set("continuation_key", input.continuationKey);
      }

      const query = params.toString();
      const path = `/accounts/${encodeURIComponent(input.accountId)}/transactions${
        query ? `?${query}` : ""
      }`;

      const body = await request(path);
      const parsed = transactionsPageSchema.parse(body);

      const transactions: EnableBankingTransaction[] = parsed.transactions.map((tx) => {
        const mapped: EnableBankingTransaction = {
          transaction_amount: tx.transaction_amount,
          credit_debit_indicator: tx.credit_debit_indicator,
        };

        if (tx.entry_reference !== undefined) {
          mapped.entry_reference = tx.entry_reference;
        }
        if (tx.transaction_id !== undefined) {
          mapped.transaction_id = tx.transaction_id;
        }
        if (tx.status !== undefined) {
          mapped.status = tx.status;
        }
        if (tx.booking_date !== undefined) {
          mapped.booking_date = tx.booking_date;
        }
        if (tx.value_date !== undefined) {
          mapped.value_date = tx.value_date;
        }
        if (tx.transaction_date !== undefined) {
          mapped.transaction_date = tx.transaction_date;
        }
        if (tx.remittance_information !== undefined) {
          mapped.remittance_information = tx.remittance_information;
        }
        if (tx.reference_number !== undefined) {
          mapped.reference_number = tx.reference_number;
        }
        if (tx.creditor !== undefined) {
          if (tx.creditor === null) {
            mapped.creditor = null;
          } else {
            mapped.creditor = {};
            if (tx.creditor.name !== undefined) {
              mapped.creditor.name = tx.creditor.name;
            }
          }
        }
        if (tx.debtor !== undefined) {
          if (tx.debtor === null) {
            mapped.debtor = null;
          } else {
            mapped.debtor = {};
            if (tx.debtor.name !== undefined) {
              mapped.debtor.name = tx.debtor.name;
            }
          }
        }
        if (tx.note !== undefined) {
          mapped.note = tx.note;
        }

        return mapped;
      });

      const result: EnableBankingTransactionsPage = { transactions };
      if (parsed.continuation_key !== undefined) {
        result.continuation_key = parsed.continuation_key;
      }
      return result;
    },
  };
}
