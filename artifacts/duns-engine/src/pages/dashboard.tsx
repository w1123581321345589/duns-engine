import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  useGetMetrics,
  useGetCases,
  useGetQuota,
  useSimulateWebhook,
  useResetDemo,
  getGetMetricsQueryKey,
  getGetCasesQueryKey,
  getGetQuotaQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { StatusBadge } from "@/components/status-badge";
import { PipelineVisualization, deriveLivePipeline } from "@/components/pipeline-viz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlusCircle, TrendingUp, Clock, CheckCircle, XCircle, Activity, Zap, RotateCcw, Trash2 } from "lucide-react";

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  loading: boolean;
}) {
  return (
    <Card data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="font-mono text-3xl font-bold mt-1 leading-none tracking-tight">{value}</p>
            )}
            {sub && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ml-3">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: metrics, isLoading: metricsLoading } = useGetMetrics({
    query: {
      queryKey: getGetMetricsQueryKey(),
      refetchInterval: 8000,
    },
  });

  const { data: casesData, isLoading: casesLoading } = useGetCases(
    { limit: 8 },
    {
      query: {
        queryKey: getGetCasesQueryKey({ limit: 8 }),
        refetchInterval: 8000,
      },
    }
  );

  const { data: quota, isLoading: quotaLoading } = useGetQuota({
    query: {
      queryKey: getGetQuotaQueryKey(),
      refetchInterval: 8000,
    },
  });

  const { mutate: fireWebhook, isPending: webhookPending } = useSimulateWebhook({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetCasesQueryKey({ limit: 8 }) });
        queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        toast({
          title: "Atlas webhook fired",
          description: `New case created. ID: ${data.case_id.slice(0, 8).toUpperCase()}. Watching it live.`,
        });
        setLocation(`/cases/${data.case_id}`);
      },
      onError: () => {
        toast({
          title: "Webhook failed",
          description: "Could not fire the Atlas webhook. Check the API server.",
          variant: "destructive",
        });
      },
    },
  });

  const { mutate: resetDemo, isPending: resetPending } = useResetDemo({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCasesQueryKey({ limit: 8 }) });
        queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetQuotaQueryKey() });
        toast({
          title: "Demo data reset",
          description: "Cases and quota were wiped and re-seeded for a clean run.",
        });
      },
      onError: () => {
        toast({
          title: "Reset failed",
          description: "Could not reset the demo data. Check the API server.",
          variant: "destructive",
        });
      },
    },
  });

  function handleSimulate() {
    fireWebhook();
  }

  const cases = casesData?.cases ?? [];

  const { activeSteps, outcomeReached } = deriveLivePipeline(metrics, cases);

  const successRate = metrics?.success_rate ?? 0;
  const avgHours = metrics?.avg_resolution_hours;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Operations Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live pipeline, refreshes every 8 seconds
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-amber-400/60 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/40 dark:text-amber-400 dark:hover:bg-amber-950/40"
              onClick={handleSimulate}
              disabled={webhookPending}
              data-testid="btn-simulate-atlas"
            >
              {webhookPending ? (
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {webhookPending ? "Firing…" : "Simulate Atlas Webhook"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                  disabled={resetPending}
                  data-testid="btn-reset-demo"
                >
                  {resetPending ? (
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  {resetPending ? "Resetting…" : "Reset Demo"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent data-testid="dialog-reset-demo">
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every case and all quota usage, then
                    re-seeds a fresh set of demo rows. Use it to start a demo from a clean
                    slate. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="btn-reset-cancel">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetDemo()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    data-testid="btn-reset-confirm"
                  >
                    Reset data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Link href="/cases/new">
              <Button size="sm" className="gap-1.5" data-testid="btn-new-request">
                <PlusCircle className="w-3.5 h-3.5" />
                New Request
              </Button>
            </Link>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard label="Total" value={metrics?.total_requests ?? 0} icon={Activity} loading={metricsLoading} />
          <MetricCard label="Pending" value={metrics?.pending ?? 0} icon={Clock} loading={metricsLoading} />
          <MetricCard label="Submitted" value={metrics?.submitted ?? 0} icon={TrendingUp} loading={metricsLoading} />
          <MetricCard label="In Progress" value={metrics?.in_progress ?? 0} icon={Activity} loading={metricsLoading} />
          <MetricCard
            label="Completed"
            value={(metrics?.completed_created ?? 0) + (metrics?.completed_exists ?? 0)}
            icon={CheckCircle}
            loading={metricsLoading}
          />
          <MetricCard label="Failed" value={metrics?.failed ?? 0} icon={XCircle} loading={metricsLoading} />
        </div>

        {/* Success Rate + Avg Resolution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card data-testid="card-success-rate">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Success Rate</p>
              {metricsLoading ? (
                <Skeleton className="h-5 w-full" />
              ) : (
                <>
                  <div className="flex items-end justify-between mb-1.5">
                    <span className="font-mono text-2xl font-bold tracking-tight">{successRate}%</span>
                    <span className="text-xs text-muted-foreground">
                      {(metrics?.completed_created ?? 0) + (metrics?.completed_exists ?? 0)} / {metrics?.total_requests ?? 0} resolved
                    </span>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </>
              )}
            </CardContent>
          </Card>
          <Card data-testid="card-avg-resolution">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Avg. Resolution Time</p>
              {metricsLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <p className="font-mono text-3xl font-bold tracking-tight">
                  {avgHours != null ? `${avgHours}h` : "—"}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">from submission to DUNS delivered</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Visualization */}
        <Card data-testid="card-pipeline">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Orchestration Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineVisualization activeSteps={activeSteps} outcomeReached={outcomeReached} />
          </CardContent>
        </Card>

        {/* Quota + Recent Cases */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Quota */}
          <Card className="lg:col-span-2" data-testid="card-quota">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Daily D&B Quota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quotaLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))
              ) : quota && quota.length > 0 ? (
                quota.map((q) => (
                  <div key={`${q.country_code}-${q.research_type}`} data-testid={`quota-row-${q.country_code}`}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{q.country_code}</span>
                      <span className="text-muted-foreground">
                        {q.used} / {q.limit}
                      </span>
                    </div>
                    <Progress
                      value={(q.used / q.limit) * 100}
                      className={`h-1.5 ${
                        q.used / q.limit > 0.9 ? "[&>div]:bg-red-500" : q.used / q.limit > 0.7 ? "[&>div]:bg-amber-500" : ""
                      }`}
                    />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">No quota activity today</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Cases */}
          <Card className="lg:col-span-3" data-testid="card-recent-cases">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Cases</CardTitle>
              <Link href="/cases">
                <Button variant="ghost" size="sm" className="text-xs h-7" data-testid="btn-view-all-cases">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {casesLoading ? (
                <div className="px-6 space-y-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  ))}
                </div>
              ) : cases.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No cases yet.{" "}
                  <Link href="/cases/new" className="text-primary underline-offset-4 hover:underline">
                    Submit the first one.
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {cases.map((c) => (
                    <div
                      key={c.case_id}
                      className="px-6 py-2.5 flex items-center justify-between gap-4"
                      data-testid={`recent-case-${c.case_id}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.city}, {c.country_code}
                          {c.duns_number ? ` · ${c.duns_number}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
