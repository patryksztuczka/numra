import type { Env } from "../env.ts";
import { createEnableBankingClient } from "./client.ts";
import type { EnableBankingClient } from "./types.ts";

export type { EnableBankingClient } from "./types.ts";
export {
  EnableBankingApiError,
  type EnableBankingAccount,
  type EnableBankingTransaction,
  type EnableBankingTransactionsPage,
  type EnableBankingSessionResponse,
} from "./types.ts";
export { createEnableBankingClient } from "./client.ts";

type ClientFactory = (env: Env) => EnableBankingClient;

let clientFactory: ClientFactory = createEnableBankingClient;

/** Override the gateway factory (tests inject a fake). */
export function setEnableBankingClientFactory(factory: ClientFactory | null) {
  clientFactory = factory ?? createEnableBankingClient;
}

export function getEnableBankingClient(env: Env): EnableBankingClient {
  return clientFactory(env);
}
