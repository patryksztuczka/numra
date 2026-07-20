import type { EnableBankingTransaction } from "../enable-banking/types.ts";
import { amountToMinorUnits } from "./money.ts";

export type NormalizedTransaction = {
  sourceExternalId: string;
  bookingDate: string;
  valueDate: string | null;
  amountMinor: number;
  currency: string;
  creditDebit: "CRDT" | "DBIT";
  description: string | null;
  counterpartyName: string | null;
  rawPayload: string;
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Prefer provider entry_reference (stable across sessions), then transaction_id,
 * else a deterministic hash of strong fields.
 */
export async function resolveSourceExternalId(tx: EnableBankingTransaction): Promise<string> {
  if (tx.entry_reference) {
    return `entry:${tx.entry_reference}`;
  }

  if (tx.transaction_id) {
    return `txid:${tx.transaction_id}`;
  }

  const material = [
    tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? "",
    tx.transaction_amount.amount,
    tx.transaction_amount.currency,
    tx.credit_debit_indicator,
    (tx.remittance_information ?? []).join("|"),
    tx.reference_number ?? "",
    tx.creditor?.name ?? "",
    tx.debtor?.name ?? "",
  ].join("\u001f");

  const hash = await sha256Hex(material);
  return `hash:${hash}`;
}

export async function normalizeTransaction(
  tx: EnableBankingTransaction,
): Promise<NormalizedTransaction> {
  const bookingDate =
    tx.booking_date ??
    tx.value_date ??
    tx.transaction_date ??
    new Date().toISOString().slice(0, 10);

  const descriptionParts = [
    ...(tx.remittance_information ?? []),
    tx.reference_number,
    tx.note,
  ].filter((part): part is string => Boolean(part && part.trim()));

  const counterparty =
    tx.credit_debit_indicator === "DBIT" ? (tx.creditor?.name ?? null) : (tx.debtor?.name ?? null);

  return {
    sourceExternalId: await resolveSourceExternalId(tx),
    bookingDate,
    valueDate: tx.value_date ?? null,
    amountMinor: amountToMinorUnits(tx.transaction_amount.amount),
    currency: tx.transaction_amount.currency,
    creditDebit: tx.credit_debit_indicator,
    description: descriptionParts.length > 0 ? descriptionParts.join(" · ") : null,
    counterpartyName: counterparty,
    rawPayload: JSON.stringify(tx),
  };
}

export function maskIban(iban: string | null | undefined): string | null {
  if (!iban) {
    return null;
  }

  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= 8) {
    return compact;
  }

  return `${compact.slice(0, 4)} •••• ${compact.slice(-4)}`;
}
