import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate, Outlet, Route, Routes, useNavigate, useSearchParams } from "react-router";

import { AppFooter, AppShell } from "./components/app-shell.tsx";
import { LegalPage } from "./components/legal-page.tsx";
import { NavBar, type AuthMode } from "./components/navbar.tsx";
import { OverviewPage } from "./components/overview-page.tsx";
import {
  fetchAccounts,
  fetchAspsps,
  fetchConnections,
  fetchTransactions,
  formatDate,
  formatDateTime,
  formatMoney,
  startBankConnect,
  type AspspOption,
  type BankAccount,
  type Connection,
  type LedgerTransaction,
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
  const navigate = useNavigate();
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
          void navigate("/", { replace: true });
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(result.error.message ?? "Sign in failed.");
        } else {
          void navigate("/", { replace: true });
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
            className="focus-ring mt-2 flex w-fit items-center gap-8 bg-[var(--ink)] px-5 py-3 font-mono text-xs tracking-[0.12em] text-white uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
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
    <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
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
      ? "bg-emerald-100 text-emerald-900"
      : props.status === "pending"
        ? "bg-amber-100 text-amber-900"
        : props.status === "expired"
          ? "bg-orange-100 text-orange-900"
          : "bg-red-100 text-red-900";

  return (
    <span
      className={`inline-flex px-2 py-1 font-mono text-[10px] tracking-[0.14em] uppercase ${tone}`}
    >
      {props.status}
    </span>
  );
}

const FALLBACK_ASPSPS: AspspOption[] = [
  { name: "Mock ASPSP", country: "PL", label: "Mock ASPSP (sandbox)" },
  { name: "PKO Bank Polski", country: "PL", label: "PKO BP" },
  { name: "Revolut", country: "LT", label: "Revolut" },
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
        body="Link Mock ASPSP (sandbox), PKO BP, or Revolut through Enable Banking. Numra stores the consent and runs ETL into the local ledger."
      />

      {connectFlash ? (
        <p
          className={`border px-3 py-2 text-sm ${
            connectStatus === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-800"
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
                    <td className="px-4 py-3 text-red-800">{connection?.lastError ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {isActive ? null : (
                        <button
                          type="button"
                          disabled={busyKey !== null}
                          onClick={() => void onConnect(aspsp)}
                          className="focus-ring bg-[var(--ink)] px-4 py-2 font-mono text-[10px] tracking-[0.12em] text-white uppercase disabled:opacity-60"
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

function AccountsPage() {
  const [items, setItems] = useState<BankAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Ledger / accounts"
        title="Accounts"
        body="Bank accounts stored in Numra after a successful Enable Banking consent. Reads never hit the live bank API."
      />
      {error ? <ErrorBanner message={error} /> : null}
      {items === null ? (
        <p className="font-mono text-sm text-[var(--muted)]">Loading accounts…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          body="Accounts appear here after you connect a bank and complete consent."
        />
      ) : (
        <div className="overflow-x-auto border border-[var(--rule)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--rule)] bg-[var(--panel)] font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Identifier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--rule)] last:border-0">
                  <td className="px-4 py-3 font-medium">{item.name ?? "Unnamed account"}</td>
                  <td className="px-4 py-3 text-[var(--soft-ink)]">
                    {item.aspspName} ({item.aspspCountry})
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{item.currency}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--soft-ink)]">
                    {item.ibanMasked ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [items, setItems] = useState<LedgerTransaction[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (filterAccountId?: string) => {
    setError(null);
    try {
      const [accountsResult, txResult] = await Promise.all([
        fetchAccounts(),
        fetchTransactions(filterAccountId ? { accountId: filterAccountId } : undefined),
      ]);
      setAccounts(accountsResult.accounts);
      setItems(txResult.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load transactions.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Ledger / cash movements"
        title="Transactions"
        body="Booked movements stored as integer minor units. Filter by account to focus on one ledger stream."
      />
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
            void load(value || undefined);
          }}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name ?? "Unnamed"} · {account.currency}
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
        <div className="overflow-x-auto border border-[var(--rule)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--rule)] bg-[var(--panel)] font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--rule)] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--soft-ink)]">
                    {formatDate(item.bookingDate)}
                  </td>
                  <td className="px-4 py-3">{item.accountName ?? "Account"}</td>
                  <td className="px-4 py-3">
                    <div>{item.description ?? "—"}</div>
                    {item.counterpartyName ? (
                      <div className="font-mono text-[11px] text-[var(--muted)]">
                        {item.counterpartyName}
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs whitespace-nowrap ${
                      item.signedAmountMinor < 0 ? "text-red-800" : "text-emerald-800"
                    }`}
                  >
                    {formatMoney(item.signedAmountMinor, item.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
