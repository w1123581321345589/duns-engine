import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useGetCases,
  getGetCasesQueryKey,
} from "@workspace/api-client-react";
import { CaseStatus } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, ChevronLeft, ChevronRight, Link2, Check } from "lucide-react";

const ALL_STATUSES: CaseStatus[] = [
  "pending_match",
  "match_found",
  "queued",
  "submitted",
  "received",
  "in_progress",
  "closed_created",
  "closed_exists",
  "closed_failed",
  "challenged",
  "error",
];

const STATUS_LABELS: Record<CaseStatus, string> = {
  pending_match: "Checking",
  match_found: "Found (existing)",
  queued: "Queued",
  submitted: "Submitted",
  received: "D&B Received",
  in_progress: "In Progress",
  closed_created: "DUNS Created",
  closed_exists: "Already Exists",
  closed_failed: "Failed",
  challenged: "Challenged",
  error: "Error",
};

const PAGE_SIZE = 20;

export default function Cases() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "all">("all");
  const [page, setPage] = useState(0);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopyLink(caseId: string) {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}cases/${caseId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(caseId);
    setTimeout(() => setCopiedId((id) => (id === caseId ? null : id)), 2000);
    toast({
      title: "Link copied",
      description: "A direct link to this case is on your clipboard.",
    });
  }

  const params = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useGetCases(params, {
    query: { queryKey: getGetCasesQueryKey(params) },
  });

  const cases = data?.cases ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleStatusChange(val: string) {
    setStatusFilter(val as CaseStatus | "all");
    setPage(0);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Cases</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isLoading ? "Loading…" : `${total} total case${total !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`status-option-${s}`}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/cases/new">
              <Button size="sm" className="gap-1.5 h-8 text-xs" data-testid="btn-new-case">
                <PlusCircle className="w-3.5 h-3.5" />
                New Request
              </Button>
            </Link>
          </div>
        </div>

        {/* Table */}
        <Card data-testid="cases-table-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Entity</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">DUNS</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confidence</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</th>
                    <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : cases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No cases found.{" "}
                        <Link href="/cases/new" className="text-primary underline-offset-4 hover:underline">
                          Submit the first one.
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    cases.map((c) => (
                      <tr
                        key={c.case_id}
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        data-testid={`case-row-${c.case_id}`}
                        onClick={() => navigate(`/cases/${c.case_id}`)}
                      >
                        <td className="px-4 py-3">
                          <Link href={`/cases/${c.case_id}`} onClick={(e) => e.stopPropagation()}>
                            <div className="font-medium truncate max-w-[200px] hover:underline underline-offset-2">{c.business_name}</div>
                          </Link>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate max-w-[200px]">
                            {c.case_id.slice(0, 8)}…
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.city}, {c.country_code}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {c.duns_number ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.match_confidence != null ? (
                            <span
                              className={`text-sm font-medium ${
                                c.match_confidence >= 8
                                  ? "text-green-600"
                                  : c.match_confidence >= 5
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                              }`}
                              data-testid={`confidence-${c.case_id}`}
                            >
                              {c.match_confidence}/10
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(c.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Copy a direct link to this case"
                            aria-label="Copy link to this case"
                            data-testid={`btn-copy-link-${c.case_id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(c.case_id);
                            }}
                          >
                            {copiedId === c.case_id ? (
                              <Check className="w-3.5 h-3.5 text-green-600" />
                            ) : (
                              <Link2 className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/70">
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    data-testid="btn-prev-page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    data-testid="btn-next-page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
