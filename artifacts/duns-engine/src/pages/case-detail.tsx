import { useRef, useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetCaseById,
  getGetCaseByIdQueryKey,
} from "@workspace/api-client-react";
import type { CaseStatus } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { PipelineVisualization } from "@/components/pipeline-viz";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Hash,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  AlertCircle,
  Link2,
  Check,
} from "lucide-react";

const PIPELINE: { status: CaseStatus; label: string; description: string }[] = [
  { status: "pending_match", label: "Match Check", description: "Searching D&B for an existing entity" },
  { status: "submitted", label: "Submitted", description: "DUNS request submitted to D&B" },
  { status: "received", label: "D&B Received", description: "D&B confirmed receipt of request" },
  { status: "in_progress", label: "In Progress", description: "D&B is actively processing the case" },
  { status: "closed_created", label: "DUNS Created", description: "New DUNS number issued and ready" },
];

const TERMINAL_STATUSES: CaseStatus[] = [
  "match_found",
  "closed_created",
  "closed_exists",
  "closed_failed",
  "challenged",
  "error",
];

const STATUS_ORDER: Record<CaseStatus, number> = {
  pending_match: 0,
  match_found: 0,
  queued: 1,
  submitted: 1,
  received: 2,
  in_progress: 3,
  closed_created: 4,
  closed_exists: 4,
  closed_failed: 4,
  challenged: 4,
  error: 4,
};

function fmt(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StageIcon({ state }: { state: "done" | "active" | "pending" | "failed" }) {
  if (state === "done") return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
  if (state === "active") return <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />;
  if (state === "failed") return <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
  return <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />;
}

function StatusTimeline({
  status,
  transitionLog,
}: {
  status: CaseStatus;
  transitionLog: Partial<Record<CaseStatus, string>>;
}) {
  const currentOrder = STATUS_ORDER[status];
  const isTerminalFail = status === "closed_failed" || status === "error" || status === "challenged";
  const isMatchFound = status === "match_found" || status === "closed_exists";

  return (
    <div className="space-y-0">
      {PIPELINE.map((stage, idx) => {
        const stageOrder = STATUS_ORDER[stage.status];
        let state: "done" | "active" | "pending" | "failed";

        if (isTerminalFail && stageOrder >= currentOrder) {
          state = stageOrder === currentOrder ? "failed" : "pending";
        } else if (stageOrder < currentOrder) {
          state = "done";
        } else if (stageOrder === currentOrder) {
          state = TERMINAL_STATUSES.includes(status) ? "done" : "active";
        } else {
          state = "pending";
        }

        const isLast = idx === PIPELINE.length - 1;

        const rawTs = transitionLog[stage.status];
        const timestamp = rawTs ? fmt(rawTs) : null;

        return (
          <div key={stage.status} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StageIcon state={state} />
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 my-1 rounded-full ${
                    state === "done" ? "bg-green-200" : "bg-border/60"
                  }`}
                  style={{ minHeight: 28 }}
                />
              )}
            </div>
            <div className="pb-6">
              <p
                className={`text-sm font-semibold leading-tight ${
                  state === "pending"
                    ? "text-muted-foreground/60"
                    : state === "failed"
                    ? "text-red-600"
                    : "text-foreground"
                }`}
              >
                {stage.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
              {timestamp && (
                <p
                  className={`text-xs mt-1 font-mono ${
                    state === "active" ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {timestamp}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Match-found terminal branch */}
      {isMatchFound && (
        <div className="flex gap-4 -mt-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Match Found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Existing DUNS record located, no new request needed
            </p>
            {transitionLog[status] && (
              <p className="text-xs mt-1 font-mono text-muted-foreground">
                {fmt(transitionLog[status])}
              </p>
            )}
          </div>
        </div>
      )}

      {status === "challenged" && (
        <div className="flex gap-4 -mt-2">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Challenged</p>
            <p className="text-xs text-muted-foreground mt-0.5">Case is under review by D&B</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex gap-4 -mt-2">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-600">Error</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              An unexpected error occurred during processing
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = window.location.href;
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
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Link copied",
      description: "A direct link to this case is on your clipboard.",
    });
  };

  const { data: caseData, isLoading, isError } = useGetCaseById(caseId!, {
    query: {
      queryKey: getGetCaseByIdQueryKey(caseId!),
      refetchInterval: 3000,
      enabled: !!caseId,
    },
  });

  const [transitionLog, setTransitionLog] = useState<Partial<Record<CaseStatus, string>>>({});
  const prevCaseId = useRef<string | null>(null);
  const prevStatus = useRef<CaseStatus | null>(null);

  useEffect(() => {
    if (!caseData || !caseId) return;
    const status = caseData.status;

    if (prevCaseId.current !== caseId) {
      setTransitionLog({
        pending_match: caseData.created_at,
        [status]: caseData.updated_at,
      });
      prevCaseId.current = caseId;
      prevStatus.current = status;
      return;
    }

    if (prevStatus.current !== null && prevStatus.current !== status) {
      setTransitionLog((prev) => ({
        ...prev,
        [status]: caseData.updated_at,
      }));
      prevStatus.current = status;
    }
  }, [caseId, caseData?.status, caseData?.updated_at, caseData?.created_at]);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div>
          <Link href="/cases">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              All Cases
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isError || !caseData ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Case not found</p>
            <p className="text-sm mt-1">Check the ID and try again.</p>
          </div>
        ) : (
          <>
            {/* Full-width per-case orchestration pipeline */}
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  Orchestration Pipeline
                  {!TERMINAL_STATUSES.includes(caseData.status) && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2 overflow-x-auto">
                <div className="min-w-[640px]">
                  <PipelineVisualization currentStatus={caseData.status} />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-5">
            {/* Left: Entity info */}
            <div className="md:col-span-3 space-y-4">
              <div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-lg p-2 mt-0.5">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-serif text-xl font-semibold leading-tight">{caseData.business_name}</h1>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {caseData.case_id}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="gap-1.5 shrink-0"
                    title="Copy a direct link to this case"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Link2 className="w-4 h-4" />
                    )}
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
                <div className="mt-3 ml-[52px]">
                  <StatusBadge status={caseData.status} />
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Entity Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{caseData.street_address}</p>
                      <p className="text-muted-foreground">
                        {[caseData.city, caseData.state, caseData.postal_code]
                          .filter(Boolean)
                          .join(", ")}{" "}
                        · {caseData.country_code}
                      </p>
                    </div>
                  </div>
                  {caseData.phone && (
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{caseData.phone}</span>
                    </div>
                  )}
                  {caseData.requestor_email && (
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{caseData.requestor_email}</span>
                    </div>
                  )}
                  {caseData.duns_number && (
                    <div className="flex items-center gap-2.5">
                      <Hash className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="font-mono font-semibold text-green-700">
                        DUNS {caseData.duns_number}
                      </span>
                    </div>
                  )}
                  {caseData.match_confidence != null && (
                    <div className="flex items-center gap-2.5">
                      <span className="w-4 h-4 flex items-center justify-center text-muted-foreground text-xs font-bold shrink-0">%</span>
                      <span>
                        Match confidence:{" "}
                        <span
                          className={`font-semibold ${
                            caseData.match_confidence >= 8
                              ? "text-green-600"
                              : caseData.match_confidence >= 5
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          {caseData.match_confidence}/10
                        </span>
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(() => {
                const s = caseData.status;
                const show =
                  s === "error" ||
                  s === "closed_failed" ||
                  s === "challenged" ||
                  (s === "queued" && !!caseData.last_error);
                if (!show) return null;
                const amber = s === "challenged" || s === "queued";
                return (
                  <Card
                    className={
                      amber
                        ? "border-amber-300/70 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20"
                        : "border-red-300/70 bg-red-50/50 dark:border-red-500/30 dark:bg-red-950/20"
                    }
                  >
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle
                        className={`text-sm font-semibold uppercase tracking-wide flex items-center gap-2 ${
                          amber ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        <AlertCircle className="w-4 h-4" />
                        {s === "queued" ? "Awaiting Capacity" : "Resolution"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2 text-sm">
                      {caseData.resolution_code && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Code</span>
                          <span className="font-mono font-medium">{caseData.resolution_code}</span>
                        </div>
                      )}
                      {caseData.last_error && (
                        <p className="text-foreground/90 leading-snug">{caseData.last_error}</p>
                      )}
                      {!caseData.resolution_code && !caseData.last_error && (
                        <p className="text-foreground/90 leading-snug">
                          {s === "error"
                            ? "Processing failed after automated retries. Check server logs for details."
                            : s === "closed_failed"
                            ? "D&B was unable to complete this request."
                            : s === "challenged"
                            ? "This case requires manual review before it can proceed."
                            : "Waiting for available D&B capacity."}
                        </p>
                      )}
                      {(caseData.attempts ?? 0) > 1 && (
                        <p className="text-xs text-muted-foreground">
                          Processing attempts: {caseData.attempts}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              <div className="text-xs text-muted-foreground space-y-1 pl-1">
                <p>Created {fmt(caseData.created_at)}</p>
                <p>Updated {fmt(caseData.updated_at)}</p>
                {caseData.closed_at && <p>Closed {fmt(caseData.closed_at)}</p>}
              </div>
            </div>

            {/* Right: Pipeline timeline */}
            <div className="md:col-span-2">
              <Card>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    Pipeline
                    {!TERMINAL_STATUSES.includes(caseData.status) && (
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <StatusTimeline
                    status={caseData.status}
                    transitionLog={transitionLog}
                  />
                </CardContent>
              </Card>
            </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
