import { useState, type FormEvent } from "react";

import { authClient } from "./lib/auth-client.ts";

type Mode = "sign-in" | "sign-up";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export function App() {
  const { data: session, isPending } = authClient.useSession();
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
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(result.error.message ?? "Sign in failed.");
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    setError(null);

    try {
      await authClient.signOut();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign out failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <div className="page-grid min-h-screen">
        <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 py-6 sm:px-10 lg:px-16">
          <a className="wordmark focus-ring" href="#top" aria-label="Numra home">
            NUM<span>/</span>RA
          </a>
          <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] uppercase">
            <span
              className={`h-2 w-2 rounded-full ${session ? "bg-[var(--signal)]" : "bg-[var(--muted)]"}`}
            />
            {isPending ? "Checking session" : session ? "Signed in" : "Signed out"}
          </div>
        </header>

        <section
          id="top"
          className="mx-auto grid w-full max-w-[1440px] gap-12 px-6 pt-16 pb-12 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-16 lg:pt-24"
        >
          <div>
            <p className="mb-5 font-mono text-[11px] tracking-[0.22em] text-[var(--blue)] uppercase">
              Access layer / allowlisted operators
            </p>
            <h1 className="max-w-4xl text-[clamp(3.2rem,7vw,7rem)] leading-[0.86] font-black tracking-[-0.065em] uppercase">
              Sign in to the
              <br />
              <span className="text-[var(--blue)]">decision room.</span>
            </h1>
            <p className="mt-8 max-w-md text-lg leading-7 text-[var(--soft-ink)]">
              Email and password access is limited to addresses on the Numra allowlist. API:{" "}
              <span className="font-mono text-sm text-[var(--ink)]">{apiUrl}</span>
            </p>
          </div>

          <div className="border border-[var(--ink)] bg-[var(--panel)] p-6 shadow-[12px_12px_0_rgb(21_87_255_/_0.14)] sm:p-8">
            {session ? (
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                    Current session
                  </p>
                  <p className="mt-4 text-3xl font-black tracking-[-0.04em]">{session.user.name}</p>
                  <p className="mt-2 font-mono text-sm text-[var(--soft-ink)]">
                    {session.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={busy}
                  className="focus-ring w-fit bg-[var(--ink)] px-5 py-3 font-mono text-xs tracking-[0.12em] text-white uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Signing out" : "Sign out"}
                </button>
              </div>
            ) : (
              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <div className="flex gap-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                  <button
                    type="button"
                    className={`focus-ring px-3 py-2 ${mode === "sign-in" ? "bg-[var(--ink)] text-white" : "border border-[var(--rule)]"}`}
                    onClick={() => {
                      setMode("sign-in");
                      setError(null);
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    className={`focus-ring px-3 py-2 ${mode === "sign-up" ? "bg-[var(--ink)] text-white" : "border border-[var(--rule)]"}`}
                    onClick={() => {
                      setMode("sign-up");
                      setError(null);
                    }}
                  >
                    Sign up
                  </button>
                </div>

                {mode === "sign-up" ? (
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                      Name
                    </span>
                    <input
                      className="focus-ring border border-[var(--rule)] bg-white px-3 py-3"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
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
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="dev@numra.local"
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
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    placeholder="At least 8 characters"
                  />
                </label>

                {error ? (
                  <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || isPending}
                  className="focus-ring mt-2 flex w-fit items-center gap-8 bg-[var(--ink)] px-5 py-3 font-mono text-xs tracking-[0.12em] text-white uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Working" : mode === "sign-up" ? "Create account" : "Sign in"}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
            )}
          </div>
        </section>

        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 border-t border-[var(--rule)] px-6 py-6 font-mono text-[10px] tracking-[0.13em] text-[var(--muted)] uppercase sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <p>Numra / closed access</p>
          <p>Better Auth · D1 · Drizzle</p>
        </footer>
      </div>
    </main>
  );
}
