import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Navigate, Outlet, Route, Routes, useNavigate, useSearchParams } from "react-router";

import { AppFooter, AppShell } from "./components/app-shell.tsx";
import { LegalPage } from "./components/legal-page.tsx";
import { NavBar, type AuthMode } from "./components/navbar.tsx";
import { OverviewPage } from "./components/overview-page.tsx";
import {
  CADENCE_LABELS,
  CADENCES,
  createRecurringSeries,
  deleteRecurringSeries,
  fetchAccounts,
  fetchAspsps,
  fetchConnections,
  fetchRecurringSeries,
  fetchTransactions,
  formatDate,
  formatDateTime,
  formatMoney,
  saveAccountCustomName,
  saveAccountOrder,
  startBankConnect,
  type AspspOption,
  type BankAccount,
  type Cadence,
  type Connection,
  type LedgerTransaction,
  type RecurringSeries,
} from "./lib/api.ts";
import { authClient } from "./lib/auth-client.ts";

type Mode = AuthMode;

export function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <AppShell>
        <p className="font-mono text-sm tracking-[0.12em] text-[var(--muted)] uppercase">
          Checking session…
        </p>
      </AppShell>
    );
  }

  return (
    <Routes>
      <Route
        path="/privacy"
        element={
          <AppShell>
            <LegalPage document="privacy" />
          </AppShell>
        }
      />
      <Route
        path="/terms"
        element={
          <AppShell>
            <LegalPage document="terms" />
          </AppShell>
        }
      />

      {session ? (
        <Route
          element={
            <AuthenticatedLayout user={{ name: session.user.name, email: session.user.email }} />
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="connections" element={<ConnectionsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      ) : (
        <>
          <Route index element={<AuthScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
}

function AuthenticatedLayout(props: { user: { name: string; email: string } }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setBusy(true);
    setError(null);

    try {
      await authClient.signOut();
      void navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <div className="page-grid flex min-h-screen flex-col">
        <NavBar user={props.user} busy={busy} onSignOut={() => void onSignOut()} />

        <section className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-10 pb-16 sm:px-10 lg:px-16">
          {error ? (
            <div className="mb-6">
              <ErrorBanner message={error} />
            </div>
          ) : null}
          <Outlet />
        </section>

        <AppFooter />
      </div>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0] || "Numra user",
        });

        if (result.error) {
          setError(result.error.message ?? "Sign up failed.");
        } else {
          window.location.reload();
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(result.error.message ?? "Sign in failed.");
        } else {
          window.location.reload();
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell header={<NavBar variant="auth" mode={mode} onModeChange={setMode} />}>
      <AuthPanel
        mode={mode}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        error={error}
        busy={busy}
        onSubmit={onSubmit}
      />
    </AppShell>
  );
}

function AuthPanel(props: {
  mode: Mode;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string | null;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="grid gap-12 pt-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div>
        <h1 className="max-w-4xl text-[clamp(3.2rem,7vw,7rem)] leading-[0.86] font-black tracking-[-0.065em] uppercase">
          Control your
          <br />
          <span className="text-[var(--blue)]">personal finances.</span>
        </h1>
        <p className="mt-8 max-w-md text-lg leading-7 text-[var(--soft-ink)]">
          See balances, track spending, and keep every account in one clear place — so you always
          know where your money stands.
        </p>
      </div>

      <div className="border border-[var(--ink)] bg-[var(--panel)] p-6 shadow-[12px_12px_0_rgb(21_87_255_/_0.14)] sm:p-8">
        <form className="flex flex-col gap-5" onSubmit={props.onSubmit}>
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
              {props.mode === "sign-up" ? "New account" : "Welcome back"}
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">
              {props.mode === "sign-up" ? "Create your account" : "Sign in to Numra"}
            </h2>
          </div>

          {props.mode === "sign-up" ? (
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                Name
              </span>
              <input
                className="focus-ring border border-[var(--rule)] bg-white px-3 py-3"
                value={props.name}
                onChange={(event) => props.setName(event.target.value)}
                autoComplete="name"
                placeholder="Ada Lovelace"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Email
            </span>
            <input
              className="focus-ring border border-[var(--rule)] bg-white px-3 py-3"
              type="email"
              required
              value={props.email}
              onChange={(event) => props.setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Password
            </span>
            <input
              className="focus-ring border border-[var(--rule)] bg-white px-3 py-3"
              type="password"
              required
              minLength={8}
              value={props.password}
              onChange={(event) => props.setPassword(event.target.value)}
              autoComplete={props.mode === "sign-up" ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
            />
          </label>

          {props.error ? <ErrorBanner message={props.error} /> : null}

          <button
            type="submit"
            disabled={props.busy}
            className="focus-ring mt-2 flex w-fit items-center gap-8 bg-[var(--ink)] px-5 py-3 font-mono text-xs tracking-[0.12em] text-[var(--on-ink)] uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          >
            {props.busy ? "Working" : props.mode === "sign-up" ? "Create account" : "Sign in"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function ErrorBanner(props: { message: string }) {
  return (
    <p className="border border-[var(--danger-rule)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
      {props.message}
    </p>
  );
}

function EmptyState(props: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-[var(--rule)] bg-white/50 px-6 py-12 text-center">
      <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
        {props.title}
      </p>
      <p className="mx-auto mt-3 max-w-md text-sm text-[var(--soft-ink)]">{props.body}</p>
    </div>
  );
}

function StatusPill(props: { status: string }) {
  const tone =
    props.status === "active"
      ? "bg-[var(--positive-bg)] text-[var(--positive)]"
      : props.status === "pending"
        ? "bg-[var(--warning-bg)] text-[var(--warning)]"
        : props.status === "expired"
          ? "bg-[var(--expired-bg)] text-[var(--expired)]"
          : "bg-[var(--danger-bg)] text-[var(--danger)]";

  return (
    <span
      className={`inline-flex px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase ${tone}`}
    >
      {props.status}
    </span>
  );
}

const FALLBACK_ASPSPS: AspspOption[] = [
  { name: "PKO Bank Polski", country: "PL", label: "PKO BP" },
];

/** Pick the most relevant stored connection for an ASPSP (active first, then newest). */
function pickConnectionForAspsp(connections: Connection[], aspsp: AspspOption): Connection | null {
  const matches = connections.filter(
    (item) =>
      item.aspspName.toLowerCase() === aspsp.name.toLowerCase() &&
      item.aspspCountry.toLowerCase() === aspsp.country.toLowerCase() &&
      item.status !== "pending",
  );

  if (matches.length === 0) {
    return null;
  }

  const active = matches.find((item) => item.status === "active");
  if (active) {
    return active;
  }

  return matches.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function ConnectionsPage() {
  const [items, setItems] = useState<Connection[] | null>(null);
  const [aspsps, setAspsps] = useState<AspspOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [connectionsResult, aspspsResult] = await Promise.all([
        fetchConnections(),
        fetchAspsps(),
      ]);
      setItems(connectionsResult.connections);
      setAspsps(aspspsResult.aspsps.length > 0 ? aspspsResult.aspsps : FALLBACK_ASPSPS);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load connections.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onConnect = async (aspsp: AspspOption) => {
    const key = `${aspsp.name}|${aspsp.country}`;
    setBusyKey(key);
    setError(null);
    try {
      const result = await startBankConnect(aspsp.name, aspsp.country);
      window.location.assign(result.redirectUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to start bank connect.");
      setBusyKey(null);
    }
  };

  const connectStatus = searchParams.get("connect");
  const connectFlash =
    connectStatus === "success"
      ? "Bank connected. Initial sync has been queued."
      : connectStatus === "error"
        ? (searchParams.get("message") ?? "Bank connection failed.")
        : null;

  const catalog = aspsps ?? FALLBACK_ASPSPS;
  const rows = catalog.map((aspsp) => ({
    aspsp,
    connection: items ? pickConnectionForAspsp(items, aspsp) : null,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Ledger / institutions"
        title="Connections"
        body="Link PKO BP through Enable Banking. Numra stores the consent and runs ETL into the local ledger."
      />

      {connectFlash ? (
        <p
          className={`border px-3 py-2 text-sm ${
            connectStatus === "success"
              ? "border-[var(--positive-rule)] bg-[var(--positive-bg)] text-[var(--positive)]"
              : "border-[var(--danger-rule)] bg-[var(--danger-bg)] text-[var(--danger)]"
          }`}
        >
          {connectFlash}
        </p>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}

      {items === null || aspsps === null ? (
        <p className="font-mono text-sm text-[var(--muted)]">Loading connections…</p>
      ) : (
        <div className="overflow-x-auto border border-[var(--rule)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--rule)] bg-[var(--panel)] font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Last synced</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ aspsp, connection }) => {
                const key = `${aspsp.name}|${aspsp.country}`;
                const isActive = connection?.status === "active";
                const isBusy = busyKey === key;

                return (
                  <tr key={key} className="border-b border-[var(--rule)] last:border-0">
                    <td className="px-4 py-3 font-medium">
                      {aspsp.label}{" "}
                      <span className="font-mono text-xs text-[var(--muted)]">{aspsp.country}</span>
                    </td>
                    <td className="px-4 py-3">
                      {connection ? (
                        <StatusPill status={connection.status} />
                      ) : (
                        <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
                          Not connected
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--soft-ink)]">
                      {formatDateTime(connection?.validUntil ?? null)}
                    </td>
                    <td className="px-4 py-3 text-[var(--soft-ink)]">
                      {formatDateTime(connection?.lastSyncedAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-[var(--danger)]">
                      {connection?.lastError ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isActive ? null : (
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() => void onConnect(aspsp)}
                          className="focus-ring bg-[var(--ink)] px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-[var(--on-ink)] uppercase disabled:opacity-60"
                        >
                          {isBusy ? "Redirecting…" : connection ? "Reconnect" : "Connect"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatAccountBalance(item: BankAccount): string {
  if (typeof item.balanceMinor !== "number" || !Number.isFinite(item.balanceMinor)) {
    return "Balance unavailable";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: item.balanceCurrency ?? item.currency,
    minimumFractionDigits: 2,
  }).format(item.balanceMinor / 100);
}

function balanceTypeLabel(type: string | null): string {
  if (type === "CLBD") return "Booked balance";
  if (type === "ITAV") return "Available balance";
  return type ? `${type} balance` : "Reported balance";
}

function accountTileStyle(index: number): CSSProperties & { "--tile-index": number } {
  return { "--tile-index": index };
}

type AccountsVariant = "bento" | "ledger" | "cards" | "currencies" | "compare";

function AccountTile(props: { item: BankAccount; index: number }) {
  const { item, index } = props;
  return (
    <article
      className={`account-tile ${index === 0 ? "account-tile-primary" : ""}`}
      style={accountTileStyle(index)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="account-institution">
            {item.aspspName} <span>{item.aspspCountry}</span>
          </p>
          <p className="mt-2 truncate text-lg font-semibold tracking-[-0.025em]">
            {item.displayName}
          </p>
        </div>
        <div className="account-currency" aria-label={`Currency ${item.currency}`}>
          {item.currency}
        </div>
      </div>
      <div className="account-balance-block">
        <p className="account-balance">{formatAccountBalance(item)}</p>
        <p className="account-balance-kind">{balanceTypeLabel(item.balanceType)}</p>
      </div>
      <div className="account-rule" />
      <dl className="account-details">
        <div>
          <dt>Account</dt>
          <dd>{item.ibanMasked ?? "Identifier unavailable"}</dd>
        </div>
        <div>
          <dt>Balance date</dt>
          <dd>{formatDate(item.balanceAsOf)}</dd>
        </div>
        <div>
          <dt>Last retrieved</dt>
          <dd>{formatDateTime(item.balanceSyncedAt)}</dd>
        </div>
      </dl>
      <div className="account-corner-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

function AccountsView(props: {
  variant: AccountsVariant;
  items: BankAccount[];
  onReorder?: (items: BankAccount[]) => void;
  onRename?: (accountId: string, customName: string | null) => Promise<void>;
}) {
  const { variant, items, onReorder, onRename } = props;
  const [draggedId, setDraggedId] = useState<string | null>(null);

  if (variant === "ledger") {
    return (
      <div className="accounts-ledger">
        {items.map((item, index) => (
          <LedgerAccountRow
            key={item.id}
            item={item}
            index={index}
            items={items}
            dragged={draggedId === item.id}
            onDraggedChange={setDraggedId}
            {...(onReorder ? { onReorder } : {})}
            {...(onRename ? { onRename } : {})}
          />
        ))}
      </div>
    );
  }

  if (variant === "cards") {
    return (
      <div className="accounts-card-deck">
        {items.map((item, index) => (
          <article key={item.id} className="bank-card" style={accountTileStyle(index)}>
            <div className="flex items-start justify-between">
              <p className="bank-card-bank">{item.aspspName}</p>
              <p className="bank-card-currency">{item.currency}</p>
            </div>
            <p className="bank-card-name">{item.displayName}</p>
            <p className="bank-card-balance">{formatAccountBalance(item)}</p>
            <div className="flex items-end justify-between gap-4">
              <p className="bank-card-iban">{item.ibanMasked ?? "No identifier"}</p>
              <p className="bank-card-sync">Updated {formatDateTime(item.balanceSyncedAt)}</p>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (variant === "currencies") {
    const groups = Map.groupBy(items, (item) => item.balanceCurrency ?? item.currency);
    return (
      <div className="currency-lanes">
        {Array.from(groups).map(([currency, accounts]) => (
          <section key={currency} className="currency-lane">
            <div className="currency-lane-label">
              <span>{currency}</span>
              <small>{accounts.length} accounts</small>
            </div>
            <div className="currency-lane-items">
              {accounts.map((item) => (
                <article key={item.id} className="currency-account">
                  <div>
                    <p className="font-semibold">{item.displayName}</p>
                    <p>{item.aspspName}</p>
                  </div>
                  <div className="text-right">
                    <strong>{formatAccountBalance(item)}</strong>
                    <p>{item.ibanMasked ?? "No identifier"}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (variant === "compare") {
    const maxBalance = Math.max(1, ...items.map((item) => Math.abs(item.balanceMinor ?? 0)));
    return (
      <div className="accounts-compare">
        {items.map((item, index) => {
          const width = Math.max(2, (Math.abs(item.balanceMinor ?? 0) / maxBalance) * 100);
          return (
            <article key={item.id} className="compare-row">
              <div className="compare-heading">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{item.displayName}</p>
                  <small>{item.aspspName}</small>
                </div>
                <strong>{formatAccountBalance(item)}</strong>
              </div>
              <div className="compare-track" aria-hidden="true">
                <span style={{ width: `${width}%` }} />
              </div>
              <div className="compare-meta">
                <span>{item.currency}</span>
                <span>{item.ibanMasked ?? "No identifier"}</span>
                <span>As of {formatDate(item.balanceAsOf)}</span>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div className="accounts-bento">
      {items.map((item, index) => (
        <AccountTile key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}

function LedgerAccountRow(props: {
  item: BankAccount;
  index: number;
  items: BankAccount[];
  dragged: boolean;
  onDraggedChange: (id: string | null) => void;
  onReorder?: (items: BankAccount[]) => void;
  onRename?: (accountId: string, customName: string | null) => Promise<void>;
}) {
  const { item, index, items } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.customName ?? item.displayName);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const customName = draft.trim() || null;
    setSaving(true);
    try {
      await props.onRename?.(item.id, customName);
      setEditing(false);
    } catch {
      // The page-level banner reports the error; keep the editor open for retry.
    } finally {
      setSaving(false);
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the row is a drag target containing separate controls
    <article
      className={`ledger-row ${props.dragged ? "ledger-row-dragging" : ""}`}
      draggable={!editing}
      onDragStart={(event) => {
        props.onDraggedChange(item.id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
      }}
      onDragEnd={() => props.onDraggedChange(null)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const sourceIndex = items.findIndex(
          (account) => account.id === event.dataTransfer.getData("text/plain"),
        );
        if (sourceIndex < 0 || sourceIndex === index) return;
        const reordered = [...items];
        const [moved] = reordered.splice(sourceIndex, 1);
        if (!moved) return;
        reordered.splice(index, 0, moved);
        props.onDraggedChange(null);
        props.onReorder?.(reordered);
      }}
    >
      <button
        type="button"
        className="ledger-drag-handle"
        aria-label={`Move ${item.displayName}. Use arrow keys to reorder.`}
        onKeyDown={(event) => {
          const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          const destination = index + offset;
          if (offset === 0 || destination < 0 || destination >= items.length) return;
          event.preventDefault();
          const reordered = [...items];
          const [moved] = reordered.splice(index, 1);
          if (!moved) return;
          reordered.splice(destination, 0, moved);
          props.onReorder?.(reordered);
        }}
      >
        <i />
        <i />
        <i />
      </button>
      <span className="ledger-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        {editing ? (
          <form
            className="flex max-w-sm items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <input
              ref={inputRef}
              maxLength={80}
              value={draft}
              disabled={saving}
              aria-label="Custom account name"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setDraft(item.customName ?? item.displayName);
                  setEditing(false);
                }
              }}
              className="focus-ring min-w-0 flex-1 border-b border-[var(--blue)] bg-transparent px-1 py-0.5 font-semibold"
            />
            <button
              type="submit"
              disabled={saving}
              className="font-mono text-[10px] text-[var(--blue)] uppercase"
            >
              {saving ? "Saving" : "Save"}
            </button>
            <button
              type="button"
              disabled={saving}
              className="font-mono text-[10px] text-[var(--muted)] uppercase"
              onClick={() => {
                setDraft(item.customName ?? item.displayName);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="focus-ring group flex max-w-full items-baseline gap-2 text-left"
            title="Rename account"
            onClick={() => setEditing(true)}
          >
            <span className="truncate font-semibold">{item.displayName}</span>
            <span
              aria-hidden="true"
              className="text-[10px] text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100"
            >
              ✎
            </span>
          </button>
        )}
        <p className="ledger-secondary">
          {item.customName && item.providerName
            ? item.providerName
            : (item.ibanMasked ?? item.aspspName)}
        </p>
      </div>
      <p className="ledger-bank">{item.aspspName}</p>
      <div>
        <p className="ledger-amount">{formatAccountBalance(item)}</p>
        <p className="ledger-secondary text-right">{balanceTypeLabel(item.balanceType)}</p>
      </div>
      <p className="ledger-date">{formatDate(item.balanceAsOf)}</p>
    </article>
  );
}

function AccountsPage() {
  const [items, setItems] = useState<BankAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const result = await fetchAccounts();
        setItems(result.accounts);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Failed to load accounts.");
      }
    })();
  }, []);

  const onRename = async (accountId: string, customName: string | null) => {
    setError(null);
    try {
      await saveAccountCustomName(accountId, customName);
      setItems(
        (current) =>
          current?.map((account) =>
            account.id === accountId
              ? {
                  ...account,
                  customName,
                  displayName: customName || account.providerName?.trim() || "Unnamed account",
                }
              : account,
          ) ?? null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to rename account.");
      throw caught;
    }
  };

  const onReorder = async (reordered: BankAccount[]) => {
    const previous = items;
    setItems(reordered);
    setSavingOrder(true);
    setError(null);
    try {
      await saveAccountOrder(reordered.map((account) => account.id));
    } catch (caught) {
      setItems(previous);
      setError(caught instanceof Error ? caught.message : "Failed to save account order.");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div>
      {error ? <ErrorBanner message={error} /> : null}
      {savingOrder ? <p className="account-order-saving">Saving order…</p> : null}
      {items === null ? (
        <div className="accounts-loading-grid" aria-label="Loading accounts">
          {[0, 1, 2].map((item) => (
            <div key={item} className="account-skeleton" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          body="Accounts appear here after you connect a bank and complete consent."
        />
      ) : (
        <AccountsView
          variant="ledger"
          items={items}
          onReorder={(next) => void onReorder(next)}
          onRename={onRename}
        />
      )}
    </div>
  );
}

function TransactionsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [items, setItems] = useState<LedgerTransaction[] | null>(null);
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async (filterAccountId?: string, offset = 0) => {
    const requestId = offset === 0 ? ++requestIdRef.current : requestIdRef.current;
    setError(null);
    if (offset > 0) setLoadingMore(true);

    try {
      const [accountsResult, seriesResult, txResult] = await Promise.all([
        offset === 0 ? fetchAccounts() : Promise.resolve(null),
        offset === 0 ? fetchRecurringSeries() : Promise.resolve(null),
        fetchTransactions({
          ...(filterAccountId ? { accountId: filterAccountId } : {}),
          limit: 50,
          offset,
        }),
      ]);

      if (requestId !== requestIdRef.current) return;
      if (accountsResult) setAccounts(accountsResult.accounts);
      if (seriesResult) setSeries(seriesResult.series);
      setItems((current) =>
        offset === 0 ? txResult.items : [...(current ?? []), ...txResult.items],
      );
      setHasMore(offset + txResult.items.length < txResult.pagination.total);
    } catch (caught) {
      if (requestId === requestIdRef.current) {
        setError(caught instanceof Error ? caught.message : "Failed to load transactions.");
      }
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, []);

  const seriesBySeedTransaction = new Map(
    series
      .filter((item) => item.seedTransactionId !== null)
      .map((item) => [item.seedTransactionId, item] as const),
  );

  const removeSeries = async (seriesId: string) => {
    setError(null);
    try {
      await deleteRecurringSeries(seriesId);
      setSeries((current) => current.filter((item) => item.id !== seriesId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to remove the series.");
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loadingMore || !items) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void load(accountId || undefined, items.length);
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [accountId, hasMore, items, load, loadingMore]);

  const transactionsByDate = items
    ? Array.from(
        items.reduce((groups, transaction) => {
          const group = groups.get(transaction.bookingDate) ?? [];
          group.push(transaction);
          groups.set(transaction.bookingDate, group);
          return groups;
        }, new Map<string, LedgerTransaction[]>()),
      )
    : [];

  return (
    <div className="space-y-8">
      {error ? <ErrorBanner message={error} /> : null}

      <label className="flex max-w-md flex-col gap-2 text-sm">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Filter by account
        </span>
        <select
          className="focus-ring border border-[var(--rule)] bg-white px-3 py-3"
          value={accountId}
          onChange={(event) => {
            const value = event.target.value;
            setAccountId(value);
            setItems(null);
            setHasMore(false);
            void load(value || undefined);
          }}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName} · {account.currency}
            </option>
          ))}
        </select>
      </label>

      {items === null ? (
        <p className="font-mono text-sm text-[var(--muted)]">Loading transactions…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          body="After a bank is connected, the hourly ETL (and the initial post-connect sync) fills this list from Enable Banking."
        />
      ) : (
        <div className="space-y-8">
          {transactionsByDate.map(([date, transactions]) => (
            <section key={date} aria-labelledby={`transactions-${date}`}>
              <h2
                id={`transactions-${date}`}
                className="mb-2 text-sm font-medium text-[var(--soft-ink)]"
              >
                {formatDate(date)}
              </h2>

              <div className="border-x border-t border-[var(--rule)] bg-white">
                {transactions.map((item) => (
                  <div key={item.id} className="border-b border-[var(--rule)]">
                    <article className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-4 sm:grid-cols-[minmax(9rem,0.45fr)_minmax(0,1fr)_auto] sm:items-center">
                      <p className="truncate text-xs text-[var(--soft-ink)] sm:text-sm">
                        {item.accountName ?? "Account"}
                      </p>
                      <div className="min-w-0 sm:row-start-1">
                        <p className="truncate text-sm font-medium">{item.description ?? "—"}</p>
                        {item.counterpartyName ? (
                          <p className="truncate font-mono text-[11px] text-[var(--muted)]">
                            {item.counterpartyName}
                          </p>
                        ) : null}
                        {item.creditDebit === "CRDT" ? (
                          seriesBySeedTransaction.has(item.id) ? (
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[10px] tracking-[0.14em] uppercase">
                              <span className="text-[var(--blue)]">
                                Recurring ·{" "}
                                {cadenceLabel(seriesBySeedTransaction.get(item.id)?.cadence ?? "")}
                              </span>
                              <button
                                type="button"
                                className="focus-ring text-[var(--muted)] hover:underline"
                                onClick={() => {
                                  const seriesId = seriesBySeedTransaction.get(item.id)?.id;
                                  if (seriesId) {
                                    void removeSeries(seriesId);
                                  }
                                }}
                              >
                                Remove
                              </button>
                            </p>
                          ) : (
                            <button
                              type="button"
                              className="focus-ring mt-1 font-mono text-[10px] tracking-[0.14em] text-[var(--blue)] uppercase hover:underline"
                              aria-expanded={markingId === item.id}
                              onClick={() =>
                                setMarkingId((current) => (current === item.id ? null : item.id))
                              }
                            >
                              {markingId === item.id ? "Cancel" : "Mark as recurring"}
                            </button>
                          )
                        ) : null}
                      </div>
                      <p
                        className={`col-start-2 row-span-2 row-start-1 self-center text-right font-mono text-xs whitespace-nowrap sm:col-start-3 ${
                          item.signedAmountMinor < 0
                            ? "text-[var(--danger)]"
                            : "text-[var(--positive)]"
                        }`}
                      >
                        {formatMoney(item.signedAmountMinor, item.currency)}
                      </p>
                    </article>

                    {markingId === item.id ? (
                      <RecurringSeriesForm
                        transaction={item}
                        onCancel={() => setMarkingId(null)}
                        onCreated={(created) => {
                          setSeries((current) => [...current, created]);
                          setMarkingId(null);
                        }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <div ref={loadMoreRef} className="h-px" aria-hidden="true" />
          {loadingMore ? (
            <p className="py-2 text-center font-mono text-xs text-[var(--muted)]">Loading more…</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function cadenceLabel(cadence: string): string {
  const known = CADENCES.find((option) => option === cadence);
  return known ? CADENCE_LABELS[known] : "Repeating";
}

/** Decimal string ("7200", "7200.5", "7200,50") to integer minor units. */
function parseAmountToMinor(value: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(value.trim().replace(/\s/g, ""));
  if (!match) {
    return null;
  }
  const whole = Number.parseInt(match[1] ?? "0", 10);
  const fraction = Number.parseInt(((match[2] ?? "") + "00").slice(0, 2), 10);
  return whole * 100 + fraction;
}

function minorToAmountInput(minor: number): string {
  return `${Math.floor(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
}

/**
 * Declares a recurring series seeded from one transaction. The cadence anchor is
 * the seed transaction's booking date; "until" is optional and open-ended by default.
 */
function RecurringSeriesForm(props: {
  transaction: LedgerTransaction;
  onCancel: () => void;
  onCreated: (series: RecurringSeries) => void;
}) {
  const { transaction } = props;
  const [label, setLabel] = useState(
    transaction.counterpartyName?.trim() || transaction.description?.trim() || "",
  );
  const [amount, setAmount] = useState(minorToAmountInput(transaction.amountMinor));
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const expectedAmountMinor = parseAmountToMinor(amount);

    if (expectedAmountMinor === null || expectedAmountMinor <= 0) {
      setError("Enter an amount like 7200.00.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await createRecurringSeries({
        transactionId: transaction.id,
        cadence,
        expectedAmountMinor,
        ...(label.trim() ? { label: label.trim() } : {}),
        endDate: endDate || null,
      });
      props.onCreated(result.series);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="border-t border-[var(--rule)] bg-[var(--panel)] px-4 py-4"
    >
      <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
        Recurring income · anchored to {formatDate(transaction.bookingDate)}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Name
          </span>
          <input
            className="focus-ring border border-[var(--rule)] bg-white px-3 py-2"
            value={label}
            maxLength={120}
            placeholder="Salary"
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Expected amount · {transaction.currency}
          </span>
          <input
            className="focus-ring border border-[var(--rule)] bg-white px-3 py-2 font-mono tabular-nums"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Repeats
          </span>
          <select
            className="focus-ring border border-[var(--rule)] bg-white px-3 py-2"
            value={cadence}
            onChange={(event) => {
              const selected = CADENCES.find((option) => option === event.target.value);
              if (selected) {
                setCadence(selected);
              }
            }}
          >
            {CADENCES.map((option) => (
              <option key={option} value={option}>
                {CADENCE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
            Until · optional
          </span>
          <input
            type="date"
            className="focus-ring border border-[var(--rule)] bg-white px-3 py-2 font-mono"
            value={endDate}
            min={transaction.bookingDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="focus-ring border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 font-mono text-[11px] tracking-[0.14em] text-[var(--on-ink)] uppercase disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={props.onCancel}
          className="focus-ring font-mono text-[11px] tracking-[0.14em] text-[var(--muted)] uppercase hover:underline"
        >
          Cancel
        </button>
        <span className="font-mono text-[11px] text-[var(--muted)]">
          Leave “until” empty for open-ended income.
        </span>
      </div>
    </form>
  );
}

function PageHeader(props: { kicker: string; title: string; body: string }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] tracking-[0.22em] text-[var(--blue)] uppercase">
        {props.kicker}
      </p>
      <h1 className="text-4xl font-black tracking-[-0.04em] uppercase sm:text-5xl">
        {props.title}
      </h1>
      <p className="mt-4 max-w-2xl text-[var(--soft-ink)]">{props.body}</p>
    </div>
  );
}
