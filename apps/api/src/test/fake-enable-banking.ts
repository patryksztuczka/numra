import {
  EnableBankingApiError,
  type EnableBankingClient,
  type EnableBankingSessionResponse,
  type EnableBankingTransaction,
  type EnableBankingTransactionsPage,
} from "../enable-banking/types.ts";

export type FakeEnableBankingOptions = {
  transactionsByAccount?: Record<string, EnableBankingTransaction[]>;
  /** When true, getTransactions throws an expired-session error. */
  expireOnTransactions?: boolean;
  /** Optional custom error on getTransactions. */
  transactionsError?: EnableBankingApiError;
};

export function createFakeEnableBankingClient(
  options: FakeEnableBankingOptions = {},
): EnableBankingClient & {
  started: Array<{ aspsp: { name: string; country: string }; state: string }>;
  sessionsCreated: string[];
} {
  const started: Array<{ aspsp: { name: string; country: string }; state: string }> = [];
  const sessionsCreated: string[] = [];
  const transactionsByAccount = options.transactionsByAccount ?? {};

  return {
    started,
    sessionsCreated,

    async startAuthorization(input) {
      started.push({ aspsp: input.aspsp, state: input.state });
      return {
        url: `https://auth.enablebanking.com/ais/start?state=${encodeURIComponent(input.state)}`,
        authorization_id: crypto.randomUUID(),
        psu_id_hash: "fake-psu-hash",
      };
    },

    async createSession(code) {
      sessionsCreated.push(code);
      const session: EnableBankingSessionResponse = {
        session_id: `session-${code}`,
        accounts: [
          {
            uid: "eb-account-1",
            identification_hash: "hash-account-1",
            name: "Main PLN",
            currency: "PLN",
            account_id: { iban: "PL61109010140000071219812874" },
          },
          {
            uid: "eb-account-2",
            identification_hash: "hash-account-2",
            name: "Everyday EUR",
            currency: "EUR",
            account_id: { iban: "LT121000011101001000" },
          },
        ],
        aspsp: { name: "PKO BP", country: "PL" },
        psu_type: "personal",
        access: {
          valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
      };
      return session;
    },

    async getTransactions(input): Promise<EnableBankingTransactionsPage> {
      if (options.transactionsError) {
        throw options.transactionsError;
      }

      if (options.expireOnTransactions) {
        throw new EnableBankingApiError("Session is expired", 401, "EXPIRED_SESSION");
      }

      // First page only — support simple continuation by splitting on continuationKey.
      const all = transactionsByAccount[input.accountId] ?? defaultTransactions();

      if (!input.continuationKey) {
        const mid = Math.ceil(all.length / 2) || all.length;
        const first = all.slice(0, mid);
        const rest = all.slice(mid);
        return {
          transactions: first,
          continuation_key: rest.length > 0 ? "page-2" : null,
        };
      }

      if (input.continuationKey === "page-2") {
        const mid = Math.ceil(all.length / 2) || all.length;
        return {
          transactions: all.slice(mid),
          continuation_key: null,
        };
      }

      return { transactions: [], continuation_key: null };
    },
  };
}

function defaultTransactions(): EnableBankingTransaction[] {
  return [
    {
      entry_reference: "tx-001",
      transaction_amount: { currency: "PLN", amount: "120.50" },
      credit_debit_indicator: "DBIT",
      status: "BOOK",
      booking_date: "2026-03-01",
      remittance_information: ["Coffee shop"],
      creditor: { name: "Cafe Roma" },
    },
    {
      entry_reference: "tx-002",
      transaction_amount: { currency: "PLN", amount: "3500.00" },
      credit_debit_indicator: "CRDT",
      status: "BOOK",
      booking_date: "2026-03-02",
      remittance_information: ["Salary"],
      debtor: { name: "Employer Sp. z o.o." },
    },
    {
      entry_reference: "tx-003",
      transaction_amount: { currency: "PLN", amount: "45.99" },
      credit_debit_indicator: "DBIT",
      status: "BOOK",
      booking_date: "2026-03-03",
      remittance_information: ["Transit"],
    },
  ];
}
