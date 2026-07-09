import { useState, useCallback, useEffect } from "react";
import type { SpeedTestResult } from "@/types/network";

const STORAGE_KEY = "sweeply-speed-history";
const MAX_HISTORY = 10;

export interface SpeedHistoryEntry extends SpeedTestResult {
  id: string;
}

function readHistory(): SpeedHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function useSpeedHistory() {
  const [history, setHistory] = useState<SpeedHistoryEntry[]>(readHistory);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
  }, [history]);

  const addEntry = useCallback((result: SpeedTestResult) => {
    const entry: SpeedHistoryEntry = {
      ...result,
      id: `speed-${Date.now()}`,
    };
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return { history, addEntry, clearHistory };
}
