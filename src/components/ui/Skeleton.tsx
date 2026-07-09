import { cn } from "@/utils/cn";

export interface SkeletonProps {
  className?: string;
  variant?: "text" | "card" | "circle" | "rect";
  width?: string | number;
  height?: string | number;
  count?: number;
}

export function Skeleton({ className, variant = "text", width, height, count = 1 }: SkeletonProps) {
  if (variant === "circle") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("shimmer rounded-full", className)} style={{ width: width || 36, height: height || 36 }} />
        ))}
      </div>
    );
  }
  if (variant === "card") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("shimmer rounded-xl", className)} style={{ width, height: height || 80 }} />
        ))}
      </div>
    );
  }
  if (variant === "rect") {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={cn("shimmer rounded-2xl", className)} style={{ width, height: height || 64 }} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", className)} style={{ width }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shimmer h-3 rounded" style={{ width: typeof width === "number" ? width : undefined }} />
      ))}
    </div>
  );
}
