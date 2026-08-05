import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import {
  fetchAccounts,
  fetchRecurringOccurrences,
  type BankAccount,
  type OccurrencesResult,
  type RecurringOccurrence,
} from "../lib/api.ts";

type MoneyItem = {
  id: string;
  name: string;
  /** Absolute amount in minor units (always positive). */
  amountMinor: number;
  /** Calendar day of month the item is due / usually lands. */
  dueDay: number;
  checked: boolean;
  /** How the check state was set in this mock. */
  via: "auto" | "manual";
  counterparty?: string;
};

const CURRENCY = "PLN";
const EXCLUDED_ACCOUNTS_KEY = "numra.overview.excludedAccountIds";

const INITIAL_PAYMENTS: MoneyItem[] = [
  {
    id: "pay-rent",
    name: "Rent",
    amountMinor: 285_000,
    dueDay: 5,
    checked: true,
    via: "auto",
    counterparty: "Jan Kowalski",
  },
  {
    id: "pay-internet",
    name: "Internet",
    amountMinor: 7_900,
    dueDay: 8,
    checked: true,
    via: "auto",
    counterparty: "Orange Fibra",
  },
  {
    id: "pay-phone",
    name: "Phone",
    amountMinor: 4_500,
    dueDay: 10,
    checked: true,
    via: "manual",
    counterparty: "Play",
  },
  {
    id: "pay-power",
    name: "Electricity",
    amountMinor: 21_467,
    dueDay: 14,
    checked: false,
    via: "manual",
    counterparty: "PGE Obrót",
  },
  {
    id: "pay-netflix",
    name: "Netflix",
    amountMinor: 4_300,
    dueDay: 16,
    checked: false,
    via: "manual",
    counterparty: "Subscription",
  },
  {
    id: "pay-gym",
    name: "Gym",
    amountMinor: 12_000,
    dueDay: 20,
    checked: false,
    via: "manual",
    counterparty: "Zdrofit",
  },
  {
    id: "pay-openai",
    name: "OpenAI",
    amountMinor: 9_900,
    dueDay: 16,
    checked: true,
    via: "auto",
    counterparty: "Subscription",
  },
];

function formatPln(minor: number, opts?: { sign?: "always" | "never" | "auto" }): string {
  const signMode = opts?.sign ?? "auto";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  const grouped = whole.toLocaleString("pl-PL");
  const body = `${grouped},${fraction} ${CURRENCY}`;

  if (signMode === "never") {
    return body;
  }
  if (signMode === "always") {
    if (minor < 0) {
      return `−${body}`;
    }
    if (minor > 0) {
      return `+${body}`;
    }
    return body;
  }
  // auto: minus only
  return minor < 0 ? `−${body}` : body;
}

function formatBalance(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function dayLabel(day: number): string {
  return `${String(day).padStart(2, "0")} Jul`;
}

/** "02 Mar" from a YYYY-MM-DD date, without touching the local timezone. */
function occurrenceDayLabel(isoDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function sumAmount(items: MoneyItem[], predicate: (item: MoneyItem) => boolean): number {
  return items.reduce((acc, item) => (predicate(item) ? acc + item.amountMinor : acc), 0);
}

function sortChecklist(items: MoneyItem[]): MoneyItem[] {
  return items.toSorted((a, b) => {
    if (a.checked !== b.checked) {
      return a.checked ? 1 : -1;
    }
    return a.dueDay - b.dueDay;
  });
}

export function OverviewPage() {
  const [payments, setPayments] = useState(INITIAL_PAYMENTS);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [incomeResult, setIncomeResult] = useState<OccurrencesResult | null>(null);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [manageAccountsOpen, setManageAccountsOpen] = useState(false);
  const [excludedAccountIds, setExcludedAccountIds] = useState<Set<string>>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(EXCLUDED_ACCOUNTS_KEY) ?? "[]");
      return new Set(
        Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [],
      );
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(EXCLUDED_ACCOUNTS_KEY, JSON.stringify(Array.from(excludedAccountIds)));
  }, [excludedAccountIds]);

  useEffect(() => {
    let active = true;
    void fetchAccounts()
      .then((result) => {
        if (active) setAccounts(result.accounts);
      })
      .catch((error: unknown) => {
        if (active) {
          setAccountsError(error instanceof Error ? error.message : "Failed to load balances.");
        }
      })
      .finally(() => {
        if (active) setAccountsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetchRecurringOccurrences({ kind: "income" })
      .then((result) => {
        if (active) setIncomeResult(result);
      })
      .catch((error: unknown) => {
        if (active) {
          setIncomeError(error instanceof Error ? error.message : "Failed to load income.");
        }
      })
      .finally(() => {
        if (active) setIncomeLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const accountsWithBalances = useMemo(
    () =>
      accounts.filter(
        (account) =>
          !excludedAccountIds.has(account.id) &&
          typeof account.balanceMinor === "number" &&
          Number.isFinite(account.balanceMinor),
      ),
    [accounts, excludedAccountIds],
  );
  const includedAccounts = accounts.filter((account) => !excludedAccountIds.has(account.id));
  const unavailableBalanceCount = includedAccounts.length - accountsWithBalances.length;
  const balancesByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const account of accountsWithBalances) {
      const currency = account.balanceCurrency ?? account.currency;
      totals.set(currency, (totals.get(currency) ?? 0) + (account.balanceMinor ?? 0));
    }
    return Array.from(totals, ([currency, minor]) => ({ currency, minor })).toSorted(
      (left, right) => Number(right.currency === CURRENCY) - Number(left.currency === CURRENCY),
    );
  }, [accountsWithBalances]);
  const balanceMinor = balancesByCurrency.find(({ currency }) => currency === CURRENCY)?.minor ?? 0;
  const oldestSync = accountsWithBalances.reduce<string | null>((oldest, account) => {
    if (!account.balanceSyncedAt) return oldest;
    if (!oldest || new Date(account.balanceSyncedAt) < new Date(oldest))
      return account.balanceSyncedAt;
    return oldest;
  }, null);

  const unpaidBillsMinor = useMemo(() => sumAmount(payments, (item) => !item.checked), [payments]);
  const paidBillsMinor = useMemo(() => sumAmount(payments, (item) => item.checked), [payments]);
  const totalBillsMinor = paidBillsMinor + unpaidBillsMinor;
  const afterBillsMinor = balanceMinor - unpaidBillsMinor;

  const incomeOccurrences = incomeResult?.occurrences ?? [];
  // Totals stay per-currency — the fixed-cost figures below are PLN-only mock data.
  const primaryIncomeTotals = incomeResult?.totals.find(({ currency }) => currency === CURRENCY);
  const otherIncomeTotals = (incomeResult?.totals ?? []).filter(
    ({ currency }) => currency !== CURRENCY,
  );
  const incomeInMinor = primaryIncomeTotals?.receivedMinor ?? 0;
  const incomeExpectedMinor = primaryIncomeTotals?.projectedMinor ?? 0;

  const incomeReceivedCount = incomeOccurrences.filter((item) => item.status === "received").length;
  const paymentsCheckedCount = payments.filter((item) => item.checked).length;

  const leftAfterFixedMinor = incomeInMinor - totalBillsMinor;

  const toggleAccount = (id: string) => {
    setExcludedAccountIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePayment = (id: string) => {
    setPayments((items) =>
      items.map((item) =>
        item.id === id ? { ...item, checked: !item.checked, via: "manual" } : item,
      ),
    );
  };

  const status =
    unpaidBillsMinor === 0
      ? { label: "Clear", detail: "All fixed payments checked off this month." }
      : unpaidBillsMinor > balanceMinor * 0.5
        ? { label: "Tight", detail: "Unpaid fixed costs are a large share of cash on hand." }
        : {
            label: "On track",
            detail: `${payments.length - paymentsCheckedCount} fixed payments still open.`,
          };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden border border-[var(--ink)] bg-[var(--panel)] shadow-[12px_12px_0_rgb(21_87_255_/_0.14)]">
        <div className="orbit pointer-events-none opacity-70" aria-hidden="true" />
        <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_0.8fr] lg:gap-12">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
              Liquid cash
            </p>
            {accountsLoading ? (
              <div
                className="mt-3 h-14 w-64 animate-pulse bg-[var(--rule)]"
                aria-label="Loading balances"
              />
            ) : balancesByCurrency.length > 0 ? (
              <div className="mt-2">
                {balancesByCurrency.map(({ currency, minor }, index) =>
                  currency === CURRENCY ? (
                    <p
                      key={currency}
                      className="font-mono text-[clamp(2rem,4.5vw,3rem)] leading-none font-black tracking-[-0.04em] text-[var(--ink)] tabular-nums"
                    >
                      {formatBalance(minor, currency)}
                    </p>
                  ) : (
                    <div
                      key={currency}
                      className={`${index === 0 ? "mt-0" : "mt-3"} flex items-baseline gap-3`}
                    >
                      <span className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
                        Other currency
                      </span>
                      <span className="font-mono text-lg font-semibold tracking-[-0.02em] text-[var(--soft-ink)] tabular-nums">
                        {formatBalance(minor, currency)}
                      </span>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--soft-ink)]">
                {accountsError ??
                  (includedAccounts.length === 0
                    ? "No accounts included in overview."
                    : "No synced balances yet.")}
              </p>
            )}
            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                After unpaid bills
              </span>
              <span
                className={`font-mono text-lg font-semibold tracking-[-0.02em] tabular-nums ${
                  afterBillsMinor < 0 ? "text-red-800" : "text-[var(--ink)]"
                }`}
              >
                {formatPln(afterBillsMinor, { sign: "never" })}
              </span>
            </p>
            {!accountsLoading && accounts.length > 0 ? (
              <div className="mt-6 max-w-xl border-t border-[var(--rule)] font-mono text-[11px]">
                <ul className="divide-y divide-[var(--rule)]">
                  {includedAccounts.slice(0, 3).map((account) => (
                    <li key={account.id} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="min-w-0 truncate text-[var(--soft-ink)]">
                        <span className="text-[var(--ink)]">{account.displayName}</span>
                        <span className="text-[var(--muted)]"> · {account.aspspName}</span>
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {account.balanceMinor === null
                          ? "Unavailable"
                          : formatBalance(
                              account.balanceMinor,
                              account.balanceCurrency ?? account.currency,
                            )}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--rule)] pt-2.5 text-[10px] tracking-[0.08em] text-[var(--muted)] uppercase">
                  <span>
                    {includedAccounts.length} of {accounts.length} included
                    {oldestSync
                      ? ` · balances since ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(oldestSync))}`
                      : ""}
                    {unavailableBalanceCount > 0 ? ` · ${unavailableBalanceCount} unavailable` : ""}
                  </span>
                  <button
                    type="button"
                    className="focus-ring text-[var(--blue)] hover:underline"
                    aria-expanded={manageAccountsOpen}
                    onClick={() => setManageAccountsOpen((open) => !open)}
                  >
                    {manageAccountsOpen ? "Done" : "Manage"}
                  </button>
                </div>
                {manageAccountsOpen ? (
                  <div className="mt-3 border border-[var(--ink)] bg-white p-3 shadow-[5px_5px_0_rgb(21_87_255_/_0.12)]">
                    <p className="mb-2 text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                      Included in overview
                    </p>
                    <ul className="divide-y divide-[var(--rule)]">
                      {accounts.map((account) => (
                        <li key={account.id}>
                          <label className="flex cursor-pointer items-center gap-3 py-2.5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--blue)]"
                              checked={!excludedAccountIds.has(account.id)}
                              onChange={() => toggleAccount(account.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-[var(--soft-ink)]">
                              {account.displayName} · {account.aspspName}
                            </span>
                            <span className="shrink-0 text-[var(--ink)] tabular-nums">
                              {account.balanceMinor === null
                                ? "Unavailable"
                                : formatBalance(
                                    account.balanceMinor,
                                    account.balanceCurrency ?? account.currency,
                                  )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between border-t border-[var(--rule)] pt-2">
                      <button
                        type="button"
                        className="focus-ring text-[var(--blue)] hover:underline"
                        onClick={() => setExcludedAccountIds(new Set())}
                      >
                        Select all
                      </button>
                      <Link
                        className="focus-ring text-[var(--blue)] hover:underline"
                        to="/accounts"
                      >
                        View accounts
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col justify-between gap-6 border-t border-[var(--rule)] pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                Month status
              </p>
              <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--blue)] uppercase">
                {status.label}
              </p>
              <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--soft-ink)]">
                {status.detail}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 font-mono text-[11px] tracking-[0.04em]">
              <div>
                <dt className="text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                  Bills still due
                </dt>
                <dd className="mt-1 text-base text-[var(--ink)] tabular-nums">
                  {formatPln(unpaidBillsMinor, { sign: "never" })}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                  Income in
                </dt>
                <dd className="mt-1 text-base text-emerald-800 tabular-nums">
                  {formatPln(incomeInMinor, { sign: "always" })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChecklistCard
          kicker="Income"
          title="Received this month"
          countLabel={incomeLoading ? "—" : `${incomeReceivedCount} / ${incomeOccurrences.length}`}
          footer={
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.04em]">
              <span>
                <span className="tracking-[0.14em] text-[var(--muted)] uppercase">In so far </span>
                <span className="text-emerald-800 tabular-nums">
                  {formatPln(incomeInMinor, { sign: "always" })}
                </span>
              </span>
              <span>
                <span className="tracking-[0.14em] text-[var(--muted)] uppercase">Expected </span>
                <span className="text-[var(--ink)] tabular-nums">
                  {formatPln(incomeExpectedMinor, { sign: "always" })}
                </span>
              </span>
              {otherIncomeTotals.map((total) => (
                <span key={total.currency}>
                  <span className="tracking-[0.14em] text-[var(--muted)] uppercase">
                    {total.currency}{" "}
                  </span>
                  <span className="text-[var(--ink)] tabular-nums">
                    {formatBalance(total.projectedMinor, total.currency)}
                  </span>
                </span>
              ))}
            </div>
          }
        >
          {incomeLoading ? (
            <li className="px-4 py-6 font-mono text-[11px] text-[var(--muted)]">Loading income…</li>
          ) : incomeError ? (
            <li className="px-4 py-6 text-sm text-red-800">{incomeError}</li>
          ) : incomeOccurrences.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--soft-ink)]">
              No recurring income yet. Open{" "}
              <Link className="focus-ring text-[var(--blue)] hover:underline" to="/transactions">
                Transactions
              </Link>{" "}
              and mark an incoming payment as recurring.
            </li>
          ) : (
            incomeOccurrences.map((occurrence) => (
              <OccurrenceRow
                key={`${occurrence.seriesId}-${occurrence.expectedDate}`}
                occurrence={occurrence}
              />
            ))
          )}
        </ChecklistCard>

        <ChecklistCard
          kicker="Fixed costs"
          title="Monthly payments"
          countLabel={`${paymentsCheckedCount} / ${payments.length}`}
          footer={
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] tracking-[0.04em]">
              <span>
                <span className="tracking-[0.14em] text-[var(--muted)] uppercase">Paid </span>
                <span className="text-[var(--ink)] tabular-nums">
                  {formatPln(-paidBillsMinor, { sign: "always" })}
                </span>
              </span>
              <span>
                <span className="tracking-[0.14em] text-[var(--muted)] uppercase">Still due </span>
                <span className="text-red-800 tabular-nums">
                  {formatPln(-unpaidBillsMinor, { sign: "always" })}
                </span>
              </span>
              <span>
                <span className="tracking-[0.14em] text-[var(--muted)] uppercase">Total </span>
                <span className="text-[var(--ink)] tabular-nums">
                  {formatPln(-totalBillsMinor, { sign: "always" })}
                </span>
              </span>
            </div>
          }
        >
          {sortChecklist(payments).map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              tone="payment"
              onToggle={() => togglePayment(item.id)}
            />
          ))}
        </ChecklistCard>
      </div>

      {/* Snapshot */}
      <section className="border border-[var(--rule)] bg-white">
        <div className="border-b border-[var(--rule)] bg-[var(--panel)] px-4 py-3 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          Month snapshot · fixed layer only
        </div>
        <div className="grid sm:grid-cols-3">
          <SnapshotCell
            label="Income in"
            value={formatPln(incomeInMinor, { sign: "always" })}
            tone="in"
          />
          <SnapshotCell
            label="Bills (all)"
            value={formatPln(-totalBillsMinor, { sign: "always" })}
            tone="out"
          />
          <SnapshotCell
            label="Left after fixed costs"
            value={formatPln(leftAfterFixedMinor, { sign: "always" })}
            tone={leftAfterFixedMinor >= 0 ? "in" : "out"}
            emphasize
          />
        </div>
        <p className="border-t border-[var(--rule)] px-4 py-3 text-sm text-[var(--soft-ink)]">
          Variable spend (groceries, dining, transport) is not on this screen yet. “Left after fixed
          costs” is income received minus the full monthly payments list — a planning figure, not
          your live balance.
        </p>
      </section>
    </div>
  );
}

function ChecklistCard(props: {
  kicker: string;
  title: string;
  countLabel: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col border border-[var(--rule)] bg-white">
      <header className="flex items-start justify-between gap-4 border-b border-[var(--rule)] bg-[var(--panel)] px-4 py-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            {props.kicker}
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.03em] uppercase">{props.title}</h2>
        </div>
        <span className="shrink-0 border border-[var(--ink)] bg-[var(--ink)] px-2 py-1 font-mono text-[10px] tracking-[0.14em] text-[var(--on-ink)] uppercase tabular-nums">
          {props.countLabel}
        </span>
      </header>
      <ul className="divide-y divide-[var(--rule)]">{props.children}</ul>
      <footer className="mt-auto border-t border-[var(--rule)] bg-[var(--panel)] px-4 py-3">
        {props.footer}
      </footer>
    </section>
  );
}

function ChecklistRow(props: {
  item: MoneyItem;
  tone: "income" | "payment";
  onToggle: () => void;
}) {
  const { item } = props;
  const amount =
    props.tone === "income"
      ? formatPln(item.amountMinor, { sign: "always" })
      : formatPln(-item.amountMinor, { sign: "always" });

  return (
    <li>
      <button
        type="button"
        onClick={props.onToggle}
        aria-pressed={item.checked}
        className={`focus-ring flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[rgb(21_87_255_/_0.03)] ${
          item.checked ? "bg-[rgb(16_28_44_/_0.02)]" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 font-mono text-[11px] leading-none ${
            item.checked
              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]"
              : "border-[var(--rule)] bg-white text-transparent"
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={`text-sm font-medium tracking-[-0.01em] ${
                item.checked
                  ? "text-[var(--muted)] line-through decoration-[var(--rule)]"
                  : "text-[var(--ink)]"
              }`}
            >
              {item.name}
            </span>
            <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase">
              {dayLabel(item.dueDay)}
            </span>
            {item.via === "auto" && item.checked ? (
              <span className="font-mono text-[9px] tracking-[0.14em] text-[var(--blue)] uppercase">
                auto
              </span>
            ) : null}
          </span>
          {item.counterparty ? (
            <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--muted)]">
              {item.counterparty}
            </span>
          ) : null}
        </span>
        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${
            item.checked
              ? "text-[var(--muted)]"
              : props.tone === "income"
                ? "text-emerald-800"
                : "text-red-800"
          }`}
        >
          {amount}
        </span>
      </button>
    </li>
  );
}

/**
 * One projected income occurrence. Not a control: the state comes from whether a
 * real transaction matched, so there is nothing for the user to toggle.
 */
function OccurrenceRow(props: { occurrence: RecurringOccurrence }) {
  const { occurrence } = props;
  const received = occurrence.status === "received";
  const actualMinor = occurrence.transaction?.amountMinor ?? null;
  const variesFromExpected = actualMinor !== null && actualMinor !== occurrence.expectedAmountMinor;

  return (
    <li
      className={`flex items-center gap-3 px-4 py-3.5 ${received ? "bg-[rgb(16_28_44_/_0.02)]" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 font-mono text-[11px] leading-none ${
          received
            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--on-ink)]"
            : occurrence.status === "late"
              ? "border-[var(--danger)] bg-white text-red-800"
              : "border-[var(--rule)] bg-white text-transparent"
        }`}
      >
        {received ? "✓" : occurrence.status === "late" ? "!" : "✓"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={`text-sm font-medium tracking-[-0.01em] ${
              received
                ? "text-[var(--muted)] line-through decoration-[var(--rule)]"
                : "text-[var(--ink)]"
            }`}
          >
            {occurrence.label}
          </span>
          <span className="font-mono text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase">
            {occurrenceDayLabel(occurrence.expectedDate)}
          </span>
          {received ? (
            <span className="font-mono text-[9px] tracking-[0.14em] text-[var(--blue)] uppercase">
              auto
            </span>
          ) : occurrence.status === "late" ? (
            <span className="font-mono text-[9px] tracking-[0.14em] text-red-800 uppercase">
              not yet
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--muted)]">
          {occurrence.counterpartyName ?? "No counterparty"}
          {variesFromExpected
            ? ` · expected ${formatBalance(occurrence.expectedAmountMinor, occurrence.currency)}`
            : ""}
        </span>
      </span>

      <span
        className={`shrink-0 font-mono text-xs tabular-nums ${
          received ? "text-[var(--muted)]" : "text-emerald-800"
        }`}
      >
        {formatBalance(actualMinor ?? occurrence.expectedAmountMinor, occurrence.currency)}
      </span>
    </li>
  );
}

function SnapshotCell(props: {
  label: string;
  value: string;
  tone: "in" | "out";
  emphasize?: boolean;
}) {
  return (
    <div
      className={`border-[var(--rule)] px-4 py-5 sm:border-r sm:last:border-r-0 ${
        props.emphasize ? "bg-[rgb(21_87_255_/_0.04)]" : ""
      }`}
    >
      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
        {props.label}
      </p>
      <p
        className={`mt-2 font-mono text-xl font-semibold tracking-[-0.02em] tabular-nums ${
          props.emphasize
            ? "text-[var(--blue)]"
            : props.tone === "in"
              ? "text-emerald-800"
              : "text-[var(--ink)]"
        }`}
      >
        {props.value}
      </p>
    </div>
  );
}
