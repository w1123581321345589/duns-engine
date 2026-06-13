import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useRunDemo } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, Globe, Zap, ShieldCheck, Network, ChevronRight, PlayCircle, Loader2 } from "lucide-react";

const pipeline = [
  "Atlas Webhook",
  "InstantPrequal",
  "IDR Match",
  "Quota Gate",
  "Submit Case",
  "Poll + Resolve",
  "DUNS Delivered",
];

const features = [
  {
    icon: Zap,
    title: "InstantPrequal",
    description:
      "Before submitting a case to D&B, we run the entity through our Ulmo matching engine. High-confidence matches return a DUNS in under 200ms, with no research slot consumed.",
  },
  {
    icon: Globe,
    title: "Global Quota Management",
    description:
      "D&B enforces per-country daily research caps. The Quota Gate tracks utilization across US, GB, DE, JP, IT, and more, automatically queuing overflow and draining it the next day.",
  },
  {
    icon: ShieldCheck,
    title: "Address Alignment",
    description:
      "SoS filings, D&B profiles, banking KYB, and Apple Developer all require a consistent address. DUNS Engine is the single source of truth that keeps them in sync.",
  },
  {
    icon: Network,
    title: "Post-Incorporation Identity",
    description:
      "DUNS is the wedge. The same orchestration layer handles EIN verification, Secretary of State record alignment, and downstream identity services. A full post-incorporation stack.",
  },
];

const stats = [
  { label: "Average resolution time", value: "< 4 hrs" },
  { label: "InstantPrequal hit rate", value: "72%" },
  { label: "Countries supported", value: "38" },
  { label: "Success rate", value: "96.4%" },
];

export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [duns, setDuns] = useState("");

  const { mutate: runDemo, isPending } = useRunDemo({
    mutation: {
      onSuccess: (data) => {
        setLocation(`/cases/${data.case_id}`);
      },
      onError: () => {
        toast({
          title: "Could not start the demo",
          description: "Check that the API server is running, then try again.",
          variant: "destructive",
        });
      },
    },
  });

  const digits = duns.replace(/\D/g, "");
  const isValid = digits.length === 9;

  function handleRun(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;
    runDemo({ data: { duns_number: digits } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-card/60 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <Building2 className="text-primary-foreground w-4 h-4" />
            </div>
            <span className="font-serif font-semibold text-sm tracking-tight">DUNS Engine</span>
          </div>
          <Link href="/dashboard">
            <Button size="sm" data-testid="btn-nav-dashboard">
              Open Dashboard
              <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-registry-grid pointer-events-none" />
        <div className="mx-auto max-w-4xl text-center relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Post-Incorporation Identity Orchestration
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] mb-6">
            Every new company needs a
            <span className="text-primary"> DUNS number.</span>
            <br />
            We handle it automatically.
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            DUNS Engine automates D&B number acquisition at Atlas scale. From Atlas webhook
            to DUNS delivered, with InstantPrequal, global quota management, and full
            address alignment across your entire identity stack.
          </p>
          <form onSubmit={handleRun} className="mx-auto max-w-lg">
            <p className="text-sm font-semibold mb-3">
              Drop in a DUNS number and watch it run live
            </p>
            <div className="flex items-center gap-2">
              <Input
                value={duns}
                onChange={(e) => setDuns(e.target.value)}
                inputMode="numeric"
                placeholder="9-digit DUNS number"
                maxLength={11}
                className="h-12 text-base font-mono text-center tracking-[0.3em]"
                data-testid="input-hero-duns"
                aria-label="DUNS number"
              />
              <Button
                type="submit"
                size="lg"
                className="gap-2 text-base h-12 px-6 shrink-0"
                disabled={!isValid || isPending}
                data-testid="btn-hero-run-demo"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                {isPending ? "Starting…" : "Run live demo"}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {digits.length > 0 && !isValid
                ? `${digits.length} / 9 digits`
                : "Your number runs through the full pipeline and is delivered live — nothing else to set up."}
            </p>
            <div className="mt-5 flex items-center justify-center gap-3 text-sm">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="btn-hero-dashboard">
                  Open operations dashboard
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
              <Link href="/cases/new">
                <Button variant="ghost" size="sm" className="text-muted-foreground" data-testid="btn-hero-new-request">
                  Submit a full request
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/60 bg-card/40 py-10 px-6">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center" data-testid={`stat-${s.label.toLowerCase().replace(/\s+/g, "-")}`}>
              <div className="font-mono text-3xl font-semibold text-primary tracking-tight">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-semibold mb-3">The orchestration pipeline</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Seven deterministic steps from incorporation event to DUNS delivered. Every step is
              observable, retryable, and quota-aware.
            </p>
          </div>
          <div className="relative">
            <div className="flex items-stretch gap-0 overflow-x-auto pb-4">
              {pipeline.map((step, i) => {
                const isLast = i === pipeline.length - 1;
                return (
                  <div key={step} className="flex items-center flex-shrink-0">
                    <div
                      className={`flex flex-col items-center justify-center text-center px-4 py-4 rounded-lg border min-w-[120px] h-20 ${
                        isLast
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border text-foreground"
                      }`}
                      data-testid={`pipeline-step-${i + 1}`}
                    >
                      <div className="text-xs font-medium leading-tight">{step}</div>
                      {isLast && (
                        <div className="text-[10px] opacity-75 mt-0.5">outcome</div>
                      )}
                    </div>
                    {!isLast && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-card/30 border-t border-border/60">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl font-semibold mb-3">More than just DUNS</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              DUNS is the wedge into post-incorporation identity. Address alignment across
              SoS filings, banking KYB, and developer accounts is the real problem worth solving.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-card border border-border rounded-xl p-6"
                  data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-serif text-3xl font-semibold mb-4">Ready to see it run?</h2>
          <p className="text-muted-foreground mb-8">
            Open the live operations dashboard to watch cases move through the pipeline in real time.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="gap-2 text-base h-12 px-10" data-testid="btn-cta-dashboard">
              Open Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8 px-6 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Building2 className="w-3.5 h-3.5" />
          DUNS Engine · Post-Incorporation Identity Orchestration
        </div>
      </footer>
    </div>
  );
}
