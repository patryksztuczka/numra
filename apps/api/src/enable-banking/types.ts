export type EnableBankingAspsp = {
  name: string;
  country: string;
};

export type EnableBankingAccount = {
  uid: string;
  identification_hash: string;
  name?: string | null;
  currency: string;
  account_id?: {
    iban?: string | null;
  } | null;
  cash_account_type?: string;
};

export type EnableBankingStartAuthResponse = {
  url: string;
  authorization_id: string;
  psu_id_hash: string;
};

export type EnableBankingSessionResponse = {
  session_id: string;
  accounts: EnableBankingAccount[];
  aspsp: EnableBankingAspsp;
  psu_type: string;
  access: {
    valid_until: string;
  };
};

export type EnableBankingTransaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: {
    currency: string;
    amount: string;
  };
  credit_debit_indicator: "CRDT" | "DBIT";
  status?: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  remittance_information?: string[] | null;
  reference_number?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  note?: string | null;
};

export type EnableBankingTransactionsPage = {
  transactions: EnableBankingTransaction[];
  continuation_key?: string | null;
};

export class EnableBankingApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "EnableBankingApiError";
    this.status = status;
    this.code = code;
  }

  get isSessionExpired(): boolean {
    return (
      this.code === "EXPIRED_SESSION" ||
      this.code === "CLOSED_SESSION" ||
      this.code === "REVOKED_SESSION" ||
      this.code === "SESSION_DOES_NOT_EXIST"
    );
  }
}

export type EnableBankingClient = {
  startAuthorization(input: {
    aspsp: EnableBankingAspsp;
    state: string;
    redirectUrl: string;
    validUntil: string;
    psuType?: "personal" | "business";
  }): Promise<EnableBankingStartAuthResponse>;

  createSession(code: string): Promise<EnableBankingSessionResponse>;

  getTransactions(input: {
    accountId: string;
    dateFrom?: string;
    dateTo?: string;
    continuationKey?: string;
  }): Promise<EnableBankingTransactionsPage>;
};
