"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "zephiel-theme";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export const useTheme = () => useContext(ThemeContext);

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Owns the theme for the whole app.
 *
 * Previously each toggle set the class itself and read it back on mount, which
 * left the choice dependent on the class surviving every navigation. Instead
 * the stored preference is the single source of truth and is re-applied on
 * every route change, so a dropped class corrects itself rather than silently
 * reverting to light.
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");

  const apply = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
  }, []);

  // Adopt the stored preference on mount.
  useEffect(() => {
    const initial = readStored() ?? systemTheme();
    setTheme(initial);
    apply(initial);
  }, [apply]);

  // Re-assert it after every navigation.
  useEffect(() => {
    const current = readStored() ?? systemTheme();
    apply(current);
    setTheme(current);
  }, [pathname, apply]);

  // Follow the system only while no explicit choice has been made.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;

    const onChange = () => {
      if (readStored()) return;
      const next = media.matches ? "dark" : "light";
      setTheme(next);
      apply(next);
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [apply]);

  // Keep other tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readStored() ?? systemTheme();
      setTheme(next);
      apply(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage blocked — the choice lasts for this page only */
      }
      return next;
    });
  }, [apply]);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
