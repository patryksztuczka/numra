import type { ReactNode } from "react";
import { Link } from "react-router";

export function AppFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 border-t border-[var(--rule)] px-6 py-6 font-mono text-[10px] tracking-[0.13em] text-[var(--muted)] uppercase sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
      <p>© {new Date().getFullYear()} Numra</p>
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Legal">
        <Link className="focus-ring hover:text-[var(--ink)]" to="/privacy">
          Privacy policy
        </Link>
        <Link className="focus-ring hover:text-[var(--ink)]" to="/terms">
          Terms
        </Link>
      </nav>
      <p>0.0.1-alpha</p>
    </footer>
  );
}

export function AppShell(props: { children: ReactNode; header?: ReactNode }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <div className="page-grid flex min-h-screen flex-col">
        {props.header ?? (
          <header className="bg-[var(--ink)] text-white">
            <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center px-6 sm:px-10 lg:px-16">
              <Link className="wordmark focus-ring text-white" to="/" aria-label="Numra home">
                NUM<span className="text-[var(--sky)]">/</span>RA
              </Link>
            </div>
          </header>
        )}

        <section className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-10 pb-16 sm:px-10 lg:px-16">
          {props.children}
        </section>

        <AppFooter />
      </div>
    </main>
  );
}
