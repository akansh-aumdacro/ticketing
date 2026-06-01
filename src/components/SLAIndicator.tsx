import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SLAIndicatorProps {
  targetDate: string | null;
  status: string;
  className?: string;
}

export function SLAIndicator({ targetDate, status, className }: SLAIndicatorProps) {
  if (!targetDate || status === "closed") return null;

  const target = new Date(targetDate);
  const now = new Date();
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-red-600", className)}>
        <AlertTriangle className="h-3 w-3" />
        Overdue by {Math.abs(diffDays)}d
      </span>
    );
  }

  if (diffDays <= 2) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold text-orange-600", className)}>
        <Clock className="h-3 w-3" />
        Due in {diffDays}d
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <CheckCircle2 className="h-3 w-3" />
      {diffDays}d remaining
    </span>
  );
}
