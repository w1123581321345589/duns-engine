import { cn } from "@/lib/utils";
import {
  Check,
  Activity,
  Clock,
  ShieldCheck,
  Database,
  Send,
  Webhook,
  X,
  AlertTriangle,
} from "lucide-react";
import type { CaseStatus } from "@workspace/api-client-react";

const steps = [
  { id: 1, label: "Atlas Webhook", icon: Webhook, description: "New incorporation" },
  { id: 2, label: "InstantPrequal", icon: ShieldCheck, description: "Entity verification" },
  { id: 3, label: "IDR Match", icon: Database, description: "Dedupe check" },
  { id: 4, label: "Quota Gate", icon: Activity, description: "25/country/day" },
  { id: 5, label: "Submit Case", icon: Send, description: "D&B Mini Research" },
  { id: 6, label: "Poll + Resolve", icon: Clock, description: "Status monitoring" },
  { id: 7, label: "DUNS Delivered", icon: Check, description: "Webhook to Atlas", isOutcome: true },
];

type StepState = "done" | "active" | "pending" | "failed" | "warn";

// Maps each case status onto the step it is currently sitting on within the
// 7-stage orchestration pipeline, plus how the run terminated (if at all).
const STATUS_STEP: Record<CaseStatus, { step: number; terminal: "success" | "fail" | "warn" | null }> = {
  pending_match: { step: 3, terminal: null },
  match_found: { step: 7, terminal: "success" },
  queued: { step: 4, terminal: null },
  submitted: { step: 5, terminal: null },
  received: { step: 6, terminal: null },
  in_progress: { step: 6, terminal: null },
  closed_created: { step: 7, terminal: "success" },
  closed_exists: { step: 7, terminal: "success" },
  closed_failed: { step: 7, terminal: "fail" },
  challenged: { step: 6, terminal: "warn" },
  error: { step: 6, terminal: "fail" },
};

/** Minimal slice of the metrics payload the live dashboard view needs. */
type LiveMetrics = {
  pending: number;
  submitted: number;
  in_progress: number;
};

/**
 * Derives which pipeline nodes should glow on the dashboard from live data.
 *
 * The visualization is a live progress tracker, not a lifetime scoreboard: it
 * lights up only while cases are actively moving through the pipeline. When
 * nothing is in flight, every node falls back to dim — even if cases completed
 * earlier (those are historical totals, not live progression).
 *
 * In-flight steps are pinned precisely from the recent-cases sample (via the
 * STATUS_STEP map, non-terminal statuses only) and supplemented with the
 * aggregate metrics buckets so in-flight cases beyond the sample still count.
 * The delivery outcome lights only when a recently sampled case has actually
 * resolved successfully, signalling a fresh delivery alongside active work.
 */
export function deriveLivePipeline(
  metrics: LiveMetrics | undefined,
  cases: { status: CaseStatus }[] = []
): { activeSteps: number[]; outcomeReached: boolean } {
  const active = new Set<number>();
  let sampledSuccess = false;

  // Precise per-status read from the recent-cases sample.
  for (const c of cases) {
    const mapping = STATUS_STEP[c.status];
    if (!mapping) continue;
    if (mapping.terminal === null) active.add(mapping.step);
    else if (mapping.terminal === "success") sampledSuccess = true;
  }

  const aggregateInFlight =
    !!metrics &&
    (metrics.pending > 0 || metrics.submitted > 0 || metrics.in_progress > 0);

  // Nothing actively moving — return all-dim regardless of historical totals.
  if (!aggregateInFlight && active.size === 0) {
    return { activeSteps: [], outcomeReached: false };
  }

  // Aggregate fallback so in-flight cases beyond the sample still register.
  if (metrics) {
    if (metrics.submitted > 0) active.add(5);
    if (metrics.in_progress > 0) active.add(6);
    // "pending" lumps pending_match (dedupe) and queued (quota gate); if the
    // sample didn't already pin one of them, light both waiting stages.
    if (metrics.pending > 0 && !active.has(3) && !active.has(4)) {
      active.add(3);
      active.add(4);
    }
  }

  return { activeSteps: [...active], outcomeReached: sampledSuccess };
}

function getLiveStepState(
  stepId: number,
  activeSteps: number[],
  outcomeReached: boolean
): StepState {
  if (activeSteps.includes(stepId)) return "active";
  if (stepId === 7 && outcomeReached) return "done";
  return "pending";
}

function getStepState(stepId: number, currentStatus?: CaseStatus): StepState {
  // Static (dashboard) mode: only the outcome node is lit.
  if (!currentStatus) {
    return stepId === 7 ? "done" : "pending";
  }

  const { step, terminal } = STATUS_STEP[currentStatus];

  if (terminal === "success") {
    return stepId <= step ? "done" : "pending";
  }

  if (terminal === "fail" || terminal === "warn") {
    if (stepId < step) return "done";
    if (stepId === step) return terminal === "warn" ? "warn" : "failed";
    return "pending";
  }

  if (stepId < step) return "done";
  if (stepId === step) return "active";
  return "pending";
}

const CIRCLE_STYLES: Record<StepState, string> = {
  done: "border-green-500 text-green-600 bg-green-50",
  active: "border-primary text-primary bg-primary/10 shadow-md shadow-primary/20 ring-2 ring-primary/25",
  pending: "border-muted text-muted-foreground/50 bg-card",
  failed: "border-red-500 text-red-600 bg-red-50",
  warn: "border-amber-500 text-amber-600 bg-amber-50",
};

const LABEL_STYLES: Record<StepState, string> = {
  done: "text-foreground",
  active: "text-primary",
  pending: "text-muted-foreground/50",
  failed: "text-red-600",
  warn: "text-amber-600",
};

export function PipelineVisualization({
  currentStatus,
  activeSteps,
  outcomeReached = false,
}: {
  currentStatus?: CaseStatus;
  /** Dashboard live mode: step ids that currently have an in-flight case. */
  activeSteps?: number[];
  /** Dashboard live mode: whether the delivery outcome has been reached. */
  outcomeReached?: boolean;
}) {
  const live = !currentStatus && activeSteps !== undefined;
  const interactive = !currentStatus && !live;

  return (
    <div className="w-full py-6">
      <div className="flex items-start justify-between w-full px-2">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const state = live
            ? getLiveStepState(step.id, activeSteps ?? [], outcomeReached)
            : getStepState(step.id, currentStatus);

          // The outcome node "lights up" with the brand color once reached.
          const outcomeLit = step.isOutcome && state === "done";

          let Icon = step.icon;
          if (state === "done" && !step.isOutcome) Icon = Check;
          else if (state === "failed") Icon = X;
          else if (state === "warn") Icon = AlertTriangle;

          const circleClass = outcomeLit
            ? "border-primary text-primary bg-primary/10 shadow-primary/20 shadow-md"
            : CIRCLE_STYLES[state];

          const labelClass = outcomeLit ? "text-primary" : LABEL_STYLES[state];

          // Connector fills in once the step it leaves has completed.
          const connectorFilled = state === "done";

          return (
            <div key={step.id} className="flex items-start flex-1">
              <div className="flex flex-col items-center group relative flex-shrink-0 flex-1">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm z-10 transition-colors",
                    circleClass,
                    state === "active" && "animate-pulse",
                    interactive &&
                      state === "pending" &&
                      "group-hover:border-primary/50 group-hover:text-primary"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="mt-2 text-center w-full px-1">
                  <div className={cn("text-[10px] font-semibold leading-tight", labelClass)}>
                    {step.label}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">
                    {step.description}
                  </div>
                </div>
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "flex-shrink-0 w-3 h-0.5 mt-5 mx-0.5 transition-colors",
                    connectorFilled ? "bg-green-400" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
