import { useState, useCallback, useEffect, useRef } from "react";

const MIN_WIDTH = 200;
const MAX_WIDTH = 320;
const STORAGE_KEY = "sweeply-sidebar-width";
const DEFAULT_WIDTH = 240;

function readStoredWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  const w = stored ? parseInt(stored, 10) : DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
}

export function useResizableSidebar() {
  const [width, setWidth] = useState(readStoredWidth);
  const draggingRef = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

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
        setWidth((w) => {
          localStorage.setItem(STORAGE_KEY, String(w));
          return w;
        });
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
