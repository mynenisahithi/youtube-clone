import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserPlus, Check, X, Video, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
});

type Profile = {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  requester: Profile | null;
  addressee: Profile | null;
};

function FriendsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const { data: friendships = [], isLoading } = useQuery({
    queryKey: ["friendships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.flatMap((f) => [f.requester_id, f.addressee_id])));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return data.map((f) => ({
        ...f,
        requester: byId.get(f.requester_id) ?? null,
        addressee: byId.get(f.addressee_id) ?? null,
      })) as Friendship[];
    },
  });

  const addFriend = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in first");
      const target = email.trim().toLowerCase();
      if (!target) throw new Error("Enter an email");
      if (target === user.email?.toLowerCase()) throw new Error("You can't add yourself");
      const { data: profile, error } = await supabase
        .from("profiles").select("id, email").eq("email", target).maybeSingle();
      if (error) throw error;
      if (!profile) throw new Error("No user found with that email");
      const { error: insErr } = await supabase.from("friendships").insert({
        requester_id: user.id, addressee_id: profile.id,
      });
      if (insErr) {
        if (insErr.code === "23505") throw new Error("Friend request already exists");
        throw insErr;
      }
    },
    onSuccess: () => {
      toast.success("Friend request sent");
      setEmail("");
      qc.invalidateQueries({ queryKey: ["friendships"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" }) => {
      const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("friendships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["friendships"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <AppShell><p>Sign in to see friends.</p></AppShell>;

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user.id);

  const other = (f: Friendship) => (f.requester_id === user.id ? f.addressee : f.requester);

  const startCall = (friendId: string) => {
    const callId = crypto.randomUUID();
    navigate({
      to: "/call/$callId",
      params: { callId },
      search: { peer: friendId, role: "caller" as const },
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Friends</h1>
          <p className="text-sm text-muted-foreground">Add friends by email, then start a video call.</p>
        </div>

        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFriend.mutate()}
          />
          <Button onClick={() => addFriend.mutate()} disabled={addFriend.isPending}>
            <UserPlus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>

        {isLoading && <p className="text-muted-foreground">Loading…</p>}

        {incoming.length > 0 && (
          <Section title="Incoming requests">
            {incoming.map((f) => {
              const p = other(f);
              return (
                <Row key={f.id} profile={p}>
                  <Button size="sm" onClick={() => respond.mutate({ id: f.id, status: "accepted" })}>
                    <Check className="mr-1 h-4 w-4" /> Accept
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                    <X className="mr-1 h-4 w-4" /> Decline
                  </Button>
                </Row>
              );
            })}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section title="Sent requests">
            {outgoing.map((f) => (
              <Row key={f.id} profile={other(f)}>
                <Badge variant="secondary">Pending</Badge>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Row>
            ))}
          </Section>
        )}

        <Section title={`Your friends (${accepted.length})`}>
          {accepted.length === 0 && <p className="text-sm text-muted-foreground">No friends yet.</p>}
          {accepted.map((f) => {
            const p = other(f);
            return (
              <Row key={f.id} profile={p}>
                <Button
                  size="sm"
                  onClick={() => p && startCall(p.id)}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <Video className="mr-1 h-4 w-4" /> Call
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(f.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Row>
            );
          })}
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar>
        <AvatarImage src={profile?.avatar_url ?? undefined} />
        <AvatarFallback>{profile?.name?.slice(0, 1) ?? "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{profile?.name ?? "Unknown"}</p>
        <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
