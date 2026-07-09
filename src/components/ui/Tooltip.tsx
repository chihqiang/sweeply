import { useState, useRef, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const SIDE_CLASSES: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({ content, children, side = "bottom", className }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setShow(true), 300);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setShow(false);
  };

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-[10000] whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-gray-700",
            "animate-fade-in pointer-events-none",
            SIDE_CLASSES[side],
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
