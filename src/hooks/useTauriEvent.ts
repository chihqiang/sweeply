import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    let unlisten: UnlistenFn;
    let cancelled = false;

    listen<T>(event, (e) => {
      if (!cancelled) handler(e.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [event, handler, enabled]);
}
