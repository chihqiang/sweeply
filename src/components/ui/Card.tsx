import { memo, type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  elevated?: boolean;
  /** 是否使用内边距 */
  padded?: boolean;
}

export const Card = memo(function Card({ hover = false, elevated = false, padded = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800/50",
        hover && "transition-all duration-200 hover:border-gray-200 hover:shadow-md dark:hover:border-gray-600",
        elevated && "shadow-lg dark:shadow-black/20",
        padded && "p-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
