import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        active: "bg-emerald-100 text-emerald-800",
        inactive: "bg-slate-100 text-slate-600",
        success: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
        pending: "bg-amber-100 text-amber-800",
        default: "bg-blue-100 text-blue-800",
        warning: "bg-orange-100 text-orange-800",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status?: "active" | "inactive" | "success" | "failed" | "pending" | "default" | "warning";
  label?: string;
}

export function StatusBadge({
  className,
  variant,
  status,
  size,
  label,
  ...props
}: StatusBadgeProps) {
  // Auto-determine variant from status if provided
  const resolvedVariant = status || variant || "default";

  return (
    <span
      className={cn(statusBadgeVariants({ variant: resolvedVariant, size }), className)}
      {...props}
    >
      {label || resolvedVariant}
    </span>
  );
}

// Helper function to map various status strings to badge variants
export function getStatusVariant(status: string | null | undefined): StatusBadgeProps["variant"] {
  if (!status) return "inactive";
  
  const s = status.toLowerCase();
  if (s === "active" || s === "enabled") return "active";
  if (s === "inactive" || s === "disabled") return "inactive";
  if (s === "success" || s === "passed" || s === "completed") return "success";
  if (s === "failed" || s === "error" || s === "rejected") return "failed";
  if (s === "pending" || s === "processing" || s === "queued") return "pending";
  if (s === "warning" || s === "caution") return "warning";
  return "default";
}
