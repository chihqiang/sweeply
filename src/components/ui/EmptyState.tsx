import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export const EmptyState = memo(function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-20 text-center", className)}>
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-800">
          <Icon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        </div>
      )}
      <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{title}</p>
      {description && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  );
});
