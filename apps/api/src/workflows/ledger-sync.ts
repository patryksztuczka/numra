import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

import { createDb } from "../db/index.ts";
import { getEnableBankingClient } from "../enable-banking/index.ts";
import type { Env } from "../env.ts";
import { runLedgerEtl } from "../finance/etl.ts";

export type LedgerSyncPayload = {
  /** When set, sync a single connection (post-connect). Otherwise sync all active. */
  connectionId?: string;
};

export class LedgerSyncWorkflow extends WorkflowEntrypoint<Env, LedgerSyncPayload> {
  override async run(event: WorkflowEvent<LedgerSyncPayload>, step: WorkflowStep) {
    const connectionId = event.payload?.connectionId;

    const result = await step.do(
      connectionId ? `sync-connection-${connectionId}` : "sync-all-active-connections",
      {
        retries: { limit: 3, delay: "30 seconds", backoff: "exponential" },
        timeout: "10 minutes",
      },
      async () => {
        const db = createDb(this.env);
        const client = getEnableBankingClient(this.env);
        return runLedgerEtl({
          db,
          env: this.env,
          client,
          ...(connectionId !== undefined ? { connectionId } : {}),
        });
      },
    );

    return result;
  }
}
