import { useState, useEffect, useCallback } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "sweeply-theme";

function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && getSystemDark());
  document.documentElement.classList.toggle("dark", isDark);
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 监听系统主题变化（仅 system 模式下响应）
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => {
    const current = theme === "system" ? getSystemDark() : theme === "dark";
    setTheme(current ? "light" : "dark");
  }, [theme, setTheme]);

  const isDark = theme === "dark" || (theme === "system" && getSystemDark());

  return { theme, setTheme, toggle, isDark };
}
