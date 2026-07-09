import { memo, useRef, useEffect, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  indeterminate?: boolean;
}

export const Checkbox = memo(function Checkbox({ label, id, className, disabled, checked, indeterminate, onChange, ...props }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate ?? false;
  }, [indeterminate]);

  return (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 cursor-pointer group", disabled && "cursor-not-allowed opacity-50", className)}>
      <div className="relative flex items-center justify-center">
        <input ref={ref} id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} className="peer sr-only" {...props} />
        <div
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded border-2 shrink-0",
            "peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 peer-focus-visible:ring-offset-1",
            (checked || indeterminate)
              ? "border-indigo-500 bg-indigo-500"
              : "border-gray-300 bg-white group-hover:border-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:group-hover:border-gray-500",
          )}
        >
          {indeterminate ? (
            <span className="h-0.5 w-2 rounded-full bg-white" />
          ) : (
            <svg
              className={cn("h-3 w-3 text-white transition-transform duration-150", checked ? "scale-100" : "scale-0")}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>}
    </label>
  );
});
