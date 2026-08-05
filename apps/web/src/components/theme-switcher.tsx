import type { ReactNode } from "react";

import { useTheme, type ThemePreference } from "../lib/theme.tsx";

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="3.25" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M16.7 12.3A7 7 0 0 1 7.7 3.3a7 7 0 1 0 9 9Z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="10.5" rx="1.5" />
        <path d="M7 17h6M10 14v3" />
      </svg>
    ),
  },
];

export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset className="theme-switcher">
      <legend className="sr-only">Color theme</legend>
      <span
        className={`theme-switcher-pill theme-switcher-pill-${preference}`}
        aria-hidden="true"
      />
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="focus-ring"
          aria-label={`${option.label} theme`}
          aria-pressed={preference === option.value}
          title={`${option.label} theme`}
          onClick={() => setPreference(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </fieldset>
  );
}
