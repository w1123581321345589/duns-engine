import { Badge } from "@/components/ui/badge";
import { CaseStatus } from "@workspace/api-client-react";

const statusConfig: Record<CaseStatus, { label: string; className: string }> = {
  pending_match: { label: "Checking", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  match_found: { label: "Found (existing)", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  queued: { label: "Queued", className: "bg-stone-200/70 text-stone-700 border-stone-300 dark:bg-stone-800/40 dark:text-stone-300 dark:border-stone-700" },
  submitted: { label: "Submitted", className: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800" },
  received: { label: "D&B Received", className: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800" },
  in_progress: { label: "In Progress", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  closed_created: { label: "DUNS Created", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  closed_exists: { label: "Already Exists", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800" },
  closed_failed: { label: "Failed", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
  challenged: { label: "Challenged", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" },
  error: { label: "Error", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800" },
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`font-medium shadow-none ${config.className}`}>
      {config.label}
    </Badge>
  );
}
