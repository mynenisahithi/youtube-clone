import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { PLANS, type PlanTier } from "@/lib/plan-limits";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/premium")({ component: PremiumPage });

function PremiumPage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const upgrade = async (plan: PlanTier) => {
    if (!user) { navigate({ to: "/auth" }); return; }
    // Mock Razorpay flow — real integration needs your Razorpay keys.
    const confirmed = confirm(`Confirm mock payment of ₹${PLANS[plan].price} for ${PLANS[plan].name}?\n\n(Razorpay Test Mode is stubbed — connect keys later.)`);
    if (!confirmed) return;
    const { error: perr } = await supabase.from("payments").insert({ user_id: user.id, plan, amount_inr: PLANS[plan].price });
    if (perr) return toast.error(perr.message);
    const { error } = await supabase.from("profiles").update({ plan }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(`Upgraded to ${PLANS[plan].name}! Invoice sent to ${user.email}.`);
    qc.invalidateQueries();
  };

  const tiers: PlanTier[] = ["free", "bronze", "silver", "gold"];
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <Crown className="mx-auto h-10 w-10 text-brand" />
          <h1 className="mt-3 text-3xl font-bold">Choose your plan</h1>
          <p className="mt-2 text-muted-foreground">Unlock longer watch times, unlimited downloads, and no ads.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((t) => {
            const p = PLANS[t];
            const current = profile?.plan === t;
            return (
              <Card key={t} className={current ? "border-brand" : ""}>
                <CardHeader>
                  <CardTitle className="capitalize">{p.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">₹{p.price}</span>
                    <span className="text-muted-foreground"> /month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-brand" />{f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={t === "gold" ? "default" : "secondary"}
                    disabled={current}
                    onClick={() => upgrade(t)}
                  >
                    {current ? "Current plan" : t === "free" ? "Downgrade" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Payments use Razorpay Test Mode (stubbed). Invoices include GST, invoice number, date, plan and amount.
        </p>
      </div>
    </AppShell>
  );
}
