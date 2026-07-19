import { useState } from "react";

type ApiState = "idle" | "checking" | "online" | "offline";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

const activity = [
  { label: "Revenue recognized", value: "$284,120", delta: "+8.4%" },
  { label: "Open commitments", value: "$61,480", delta: "12 items" },
  { label: "Operating runway", value: "14.2 mo", delta: "+0.6 mo" },
];

export function App() {
  const [apiState, setApiState] = useState<ApiState>("idle");

  const checkApi = async () => {
    setApiState("checking");

    try {
      const response = await fetch(`${apiUrl}/health`);
      setApiState(response.ok ? "online" : "offline");
    } catch {
      setApiState("offline");
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
              className={`h-2 w-2 rounded-full ${apiState === "online" ? "bg-[var(--signal)]" : "bg-[var(--muted)]"}`}
            />
            Worker {apiState === "idle" ? "not checked" : apiState}
          </div>
        </header>

        <section
          id="top"
          className="mx-auto grid w-full max-w-[1440px] gap-12 px-6 pt-16 pb-12 sm:px-10 lg:grid-cols-[1.25fr_0.75fr] lg:px-16 lg:pt-24"
        >
          <div>
            <p className="mb-5 font-mono text-[11px] tracking-[0.22em] text-[var(--blue)] uppercase">
              Decision workspace / 19 July
            </p>
            <h1 className="max-w-4xl text-[clamp(3.6rem,8vw,8.5rem)] leading-[0.82] font-black tracking-[-0.065em] uppercase">
              Numbers that
              <br />
              <span className="text-[var(--blue)]">move with you.</span>
            </h1>
          </div>

          <div className="flex flex-col justify-end border-l border-[var(--rule)] pl-6 lg:pb-2 lg:pl-9">
            <p className="max-w-sm text-lg leading-7 text-[var(--soft-ink)]">
              One place for the figures that shape the week. Current, legible, and close to the
              decision.
            </p>
            <button
              type="button"
              onClick={checkApi}
              disabled={apiState === "checking"}
              className="focus-ring mt-8 flex w-fit items-center gap-8 bg-[var(--ink)] px-5 py-3 font-mono text-xs tracking-[0.12em] text-white uppercase transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
            >
              {apiState === "checking" ? "Checking worker" : "Check worker"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1440px] px-6 pb-16 sm:px-10 lg:px-16">
          <div className="status-rail grid overflow-hidden border border-[var(--ink)] bg-[var(--ink)] text-white lg:grid-cols-[0.72fr_1.28fr]">
            <div className="relative flex min-h-64 flex-col justify-between overflow-hidden p-7 sm:p-9">
              <div className="orbit" aria-hidden="true" />
              <p className="relative z-10 font-mono text-[10px] tracking-[0.2em] uppercase">
                Current position
              </p>
              <div className="relative z-10">
                <p className="text-[clamp(4rem,9vw,8rem)] leading-none font-black tracking-[-0.07em]">
                  87<span className="text-[0.35em] text-[var(--sky)]">%</span>
                </p>
                <p className="mt-2 text-sm text-white/65">of the monthly plan secured</p>
              </div>
            </div>

            <div className="bg-[var(--panel)] text-[var(--ink)]">
              <div className="flex items-center justify-between border-b border-[var(--rule)] px-6 py-5 sm:px-8">
                <h2 className="text-sm font-bold tracking-[0.08em] uppercase">Signal ledger</h2>
                <span className="font-mono text-[10px] text-[var(--muted)] uppercase">
                  Updated now
                </span>
              </div>
              <div>
                {activity.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[1fr_auto] items-end gap-4 border-b border-[var(--rule)] px-6 py-6 last:border-b-0 sm:grid-cols-[1fr_1fr_auto] sm:px-8"
                  >
                    <p className="text-sm text-[var(--soft-ink)]">{item.label}</p>
                    <p className="hidden text-right text-2xl font-bold tracking-[-0.03em] sm:block">
                      {item.value}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--blue)]">{item.delta}</p>
                    <p className="col-span-2 text-2xl font-bold tracking-[-0.03em] sm:hidden">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 border-t border-[var(--rule)] px-6 py-6 font-mono text-[10px] tracking-[0.13em] text-[var(--muted)] uppercase sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <p>Numra / operational clarity</p>
          <p>React · Hono · Cloudflare Workers</p>
        </footer>
      </div>
    </main>
  );
}
