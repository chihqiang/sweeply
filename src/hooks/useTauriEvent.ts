import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    const promise = listen<T>(event, (e) => {
      if (!cancelled) handler(e.payload);
    }).then((fn) => {
      // 若组件在 listen 解析完成前已卸载，立即移除监听，避免泄漏
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
      // 若 listen 仍在解析中，等它解析后主动取消注册
      if (promise) void promise;
    };
  }, [event, handler, enabled]);
}