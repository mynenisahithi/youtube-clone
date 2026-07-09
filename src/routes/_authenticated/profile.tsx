import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PLANS } from "@/lib/plan-limits";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "", city: "", state: "", preferred_language: "en" });

  useEffect(() => {
    if (profile) setForm({
      name: profile.name || "", phone: profile.phone || "",
      city: profile.city || "", state: profile.state || "",
      preferred_language: profile.preferred_language || "en",
    });
  }, [profile]);

  const { data: dlCount = 0 } = useQuery({
    queryKey: ["profile-dl-count", user?.id],
    queryFn: async () => (await supabase.from("downloads").select("*", { count: "exact", head: true }).eq("user_id", user!.id)).count ?? 0,
    enabled: !!user,
  });
  const { data: histCount = 0 } = useQuery({
    queryKey: ["profile-hist-count", user?.id],
    queryFn: async () => (await supabase.from("history").select("*", { count: "exact", head: true }).eq("user_id", user!.id)).count ?? 0,
    enabled: !!user,
  });

  const save = async () => {
    localStorage.setItem("user_state", form.state);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  if (!profile) return <AppShell><p>Loading…</p></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="h-20 w-20"><AvatarImage src={profile.avatar_url ?? undefined} /><AvatarFallback className="text-2xl">{profile.name?.[0] ?? "?"}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex flex-wrap items-center gap-2">{profile.name || "Unnamed"}
                {profile.plan !== "free" && <Badge className="gap-1 bg-brand text-brand-foreground"><Crown className="h-3 w-3" />{profile.plan}</Badge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="mt-1 text-sm">Current plan: <b>{PLANS[profile.plan].name}</b> · {PLANS[profile.plan].downloads} downloads</p>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Karnataka" /></div>
            <div><Label>Preferred language (ISO)</Label><Input value={form.preferred_language} onChange={(e) => setForm({ ...form, preferred_language: e.target.value })} placeholder="en / hi / ta / te / kn" /></div>
            <div className="flex items-end"><Button onClick={save}>Save changes</Button></div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Downloads" value={dlCount} />
          <Stat label="Watch history" value={histCount} />
          <Stat label="Plan" value={PLANS[profile.plan].name} />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}
