import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type NavPage = "overview" | "accounts" | "transactions" | "connections";

export type NavUser = {
  name: string;
  email: string;
};

export type NavBarProps = {
  page: NavPage;
  user: NavUser;
  busy?: boolean | undefined;
  onNavigate: (page: NavPage) => void;
  onSignOut: () => void;
};

const NAV_ITEMS: { id: NavPage; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "accounts", label: "Accounts" },
  { id: "transactions", label: "Transactions" },
  { id: "connections", label: "Connections" },
];

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: "Operator", last: "" };
  }
  if (parts.length === 1) {
    return { first: parts[0]!, last: "" };
  }
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function initials(name: string, email: string): string {
  const { first, last } = splitName(name);
  if (first && last) {
    return `${first[0]}${last[0]}`.toUpperCase();
  }
  if (first && first.length >= 2) {
    return first.slice(0, 2).toUpperCase();
  }
  return (email.slice(0, 2) || "NU").toUpperCase();
}

function useMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { open, setOpen, rootRef, menuId };
}

function UserMenuCard(props: {
  user: NavUser;
  busy?: boolean | undefined;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const { first, last } = splitName(props.user.name);

  return (
    <div
      role="menu"
      className="account-menu absolute top-[calc(100%+0.55rem)] right-0 z-40 w-64 origin-top-right border border-[rgb(255_255_255_/_0.12)] bg-[var(--ink)] p-3 text-white shadow-[0_18px_50px_rgb(0_0_0_/_0.35)]"
    >
      <div className="account-menu-item min-w-0 border-b border-white/10 pb-3">
        <p className="truncate text-sm font-semibold tracking-[-0.01em]">
          {first}
          {last ? ` ${last}` : ""}
        </p>
        <p className="truncate font-mono text-[11px] text-white/55">{props.user.email}</p>
      </div>
      <button
        type="button"
        role="menuitem"
        disabled={props.busy}
        onClick={() => {
          props.onClose();
          props.onSignOut();
        }}
        className="account-menu-item focus-ring mt-3 w-full bg-white/8 px-3 py-2 text-left font-mono text-[10px] tracking-[0.14em] uppercase transition-colors hover:bg-white/12 disabled:opacity-60"
      >
        Sign out
      </button>
    </div>
  );
}

type PillRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function NavBar(props: NavBarProps) {
  const menu = useMenu();
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<NavPage, HTMLButtonElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);
  const [pillReady, setPillReady] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const tab = tabRefs.current.get(props.page);
      const list = tabListRef.current;
      if (!tab || !list) {
        return;
      }

      setPill({
        left: tab.offsetLeft,
        top: tab.offsetTop,
        width: tab.offsetWidth,
        height: tab.offsetHeight,
      });
      setPillReady(true);
    };

    measure();

    const list = tabListRef.current;
    if (!list || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const tab of tabRefs.current.values()) {
      observer.observe(tab);
    }

    return () => observer.disconnect();
  }, [props.page]);

  return (
    <header className="bg-[var(--ink)] text-white">
      <div className="relative mx-auto flex h-16 w-full max-w-[1440px] items-center px-6 sm:px-10 lg:px-16">
        <div className="z-10">
          <a className="wordmark focus-ring text-white" href="/" aria-label="Numra home">
            NUM<span className="text-[var(--sky)]">/</span>RA
          </a>
        </div>
        <nav
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          aria-label="Primary"
        >
          <div
            ref={tabListRef}
            role="tablist"
            className="pointer-events-auto relative flex items-center gap-0.5 rounded-full border border-white/12 bg-white/6 p-1"
          >
            {pill ? (
              <span
                aria-hidden="true"
                className={`nav-pill absolute rounded-full bg-[var(--blue)] shadow-sm ${
                  pillReady ? "nav-pill-ready" : ""
                }`}
                style={{
                  width: pill.width,
                  height: pill.height,
                  transform: `translate3d(${pill.left}px, ${pill.top}px, 0)`,
                }}
              />
            ) : null}
            {NAV_ITEMS.map((item) => {
              const active = props.page === item.id;
              return (
                <button
                  key={item.id}
                  ref={(node) => {
                    if (node) {
                      tabRefs.current.set(item.id, node);
                    } else {
                      tabRefs.current.delete(item.id);
                    }
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => props.onNavigate(item.id)}
                  className={`focus-ring relative z-10 rounded-full px-4 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors duration-300 ${
                    active ? "text-white" : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="relative z-10 ml-auto" ref={menu.rootRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menu.open}
            aria-controls={menu.menuId}
            onClick={() => menu.setOpen((value) => !value)}
            className={`focus-ring flex items-center gap-2 rounded-full border border-white/15 bg-white/8 py-1 pr-2 pl-1 transition-[border-color,background-color,transform] duration-200 hover:border-white/30 ${
              menu.open ? "border-white/30 bg-white/12" : ""
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--blue)] font-mono text-[11px] font-bold text-white">
              {initials(props.user.name, props.user.email)}
            </span>
            <span className="hidden pr-1 font-mono text-[10px] tracking-[0.12em] text-white/55 uppercase sm:inline">
              Account
            </span>
            <span className="sr-only">Open account menu</span>
          </button>
          {menu.open ? (
            <div id={menu.menuId}>
              <UserMenuCard
                user={props.user}
                busy={props.busy}
                onSignOut={props.onSignOut}
                onClose={() => menu.setOpen(false)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
