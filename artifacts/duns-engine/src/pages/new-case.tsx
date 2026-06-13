import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCase,
  getGetCasesQueryKey,
  getGetMetricsQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2 } from "lucide-react";

const COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "JP", label: "Japan" },
  { code: "IT", label: "Italy" },
  { code: "CA", label: "Canada" },
  { code: "FR", label: "France" },
  { code: "AU", label: "Australia" },
  { code: "NL", label: "Netherlands" },
  { code: "SG", label: "Singapore" },
];

const formSchema = z.object({
  business_name: z.string().min(1, "Legal entity name is required"),
  street_address: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().min(2, "Country is required"),
  phone: z.string().optional(),
  requestor_email: z.string().email("Enter a valid email").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCase() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createCase = useCreateCase();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      business_name: "",
      street_address: "",
      city: "",
      state: "",
      postal_code: "",
      country_code: "US",
      phone: "",
      requestor_email: "",
    },
  });

  function onSubmit(values: FormValues) {
    createCase.mutate(
      {
        data: {
          business_name: values.business_name,
          street_address: values.street_address,
          city: values.city,
          country_code: values.country_code,
          state: values.state || undefined,
          postal_code: values.postal_code || undefined,
          phone: values.phone || undefined,
          requestor_email: values.requestor_email || undefined,
        },
      },
      {
        onSuccess: (newCase) => {
          queryClient.invalidateQueries({ queryKey: getGetCasesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
          toast({
            title: "Case submitted",
            description: `Case ID: ${newCase.case_id.slice(0, 8)} is progressing through the pipeline.`,
          });
          setLocation(`/cases/${newCase.case_id}`);
        },
        onError: () => {
          toast({
            title: "Submission failed",
            description: "Unable to create the case. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            data-testid="btn-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight">New DUNS Request</h1>
              <p className="text-sm text-muted-foreground">
                Submit a business entity for D-U-N-S number acquisition
              </p>
            </div>
          </div>
        </div>

        <Card data-testid="new-case-form-card">
          <CardHeader>
            <CardTitle className="text-base">Entity Information</CardTitle>
            <CardDescription className="text-sm">
              Enter the registered legal entity details exactly as they appear on incorporation documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" data-testid="form-new-case">
              {/* Legal Name */}
              <div className="space-y-1.5">
                <Label htmlFor="business_name">
                  Legal Entity Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="business_name"
                  placeholder="Acme Corp Inc."
                  data-testid="input-business-name"
                  {...form.register("business_name")}
                />
                {form.formState.errors.business_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.business_name.message}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label htmlFor="street_address">
                  Street Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="street_address"
                  placeholder="123 Main St, Suite 400"
                  data-testid="input-street-address"
                  {...form.register("street_address")}
                />
                {form.formState.errors.street_address && (
                  <p className="text-xs text-destructive">{form.formState.errors.street_address.message}</p>
                )}
              </div>

              {/* City / State / Postal */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="city">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="city"
                    placeholder="San Francisco"
                    data-testid="input-city"
                    {...form.register("city")}
                  />
                  {form.formState.errors.city && (
                    <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="state">State / Region</Label>
                  <Input
                    id="state"
                    placeholder="CA"
                    data-testid="input-state"
                    {...form.register("state")}
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    placeholder="94105"
                    data-testid="input-postal-code"
                    {...form.register("postal_code")}
                  />
                </div>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <Label>
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.watch("country_code")}
                  onValueChange={(v) => form.setValue("country_code", v)}
                >
                  <SelectTrigger data-testid="select-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code} data-testid={`country-option-${c.code}`}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.country_code && (
                  <p className="text-xs text-destructive">{form.formState.errors.country_code.message}</p>
                )}
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Business Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 415 555 0100"
                    data-testid="input-phone"
                    {...form.register("phone")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="requestor_email">Notification Email</Label>
                  <Input
                    id="requestor_email"
                    type="email"
                    placeholder="founder@example.com"
                    data-testid="input-email"
                    {...form.register("requestor_email")}
                  />
                  {form.formState.errors.requestor_email && (
                    <p className="text-xs text-destructive">{form.formState.errors.requestor_email.message}</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Case will auto-progress through the pipeline in demo mode.
                </p>
                <Button
                  type="submit"
                  disabled={createCase.isPending}
                  className="min-w-[140px]"
                  data-testid="btn-submit-case"
                >
                  {createCase.isPending ? "Submitting…" : "Submit Request"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
