import { memo, type ButtonHTMLAttributes, type Ref } from "react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-indigo-500 text-white shadow-md shadow-indigo-500/25 hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 active:bg-indigo-600 active:scale-[0.98]",
  danger: "bg-red-500 text-white shadow-md shadow-red-500/25 hover:bg-red-600 hover:shadow-lg hover:shadow-red-500/30 active:bg-red-600 active:scale-[0.98]",
  ghost: "bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800/60",
  outline: "border border-gray-200 bg-white/80 text-gray-700 backdrop-blur-sm hover:bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:border-gray-600",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-6 text-sm rounded-xl gap-2",
  icon: "h-8 w-8 rounded-lg",
};

export const Button = memo(function Button({
  variant = "primary", size = "md", loading, fullWidth, disabled, className, children, ref, ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-200 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        VARIANT[variant],
        SIZE[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
});
