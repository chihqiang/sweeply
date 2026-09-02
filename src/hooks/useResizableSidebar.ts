import { useState, useCallback, useEffect, useRef } from "react";

const MIN_WIDTH = 200;
const MAX_WIDTH = 320;
const STORAGE_KEY = "sweeply-sidebar-width";
const DEFAULT_WIDTH = 240;

function readStoredWidth(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const w = stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w || DEFAULT_WIDTH));
  } catch {
    return DEFAULT_WIDTH;
  }
}

export function useResizableSidebar() {
  const [width, setWidth] = useState(readStoredWidth);
  const draggingRef = useRef(false);
  const widthRef = useRef(width);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        // 在 updater 之外持久化最新宽度（避免 updater 内含副作用被 StrictMode 双调用）
        try {
          localStorage.setItem(STORAGE_KEY, String(widthRef.current));
        } catch {
          /* 存储不可用时忽略 */
        }
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return { width, onMouseDown };
}
