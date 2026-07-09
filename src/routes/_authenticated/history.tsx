import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VideoCard, type VideoRow } from "@/components/VideoCard";

export const Route = createFileRoute("/_authenticated/history")({ component: HistoryPage });

function HistoryPage() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("history")
        .select("watched_at, videos(*)").eq("user_id", user!.id)
        .order("watched_at", { ascending: false }).limit(100);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).map((r: any) => r.videos as VideoRow).filter((v) => {
        if (!v || seen.has(v.id)) return false;
        seen.add(v.id); return true;
      });
    },
  });
  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold">Watch history</h1>
      {data.length === 0 ? <p className="text-muted-foreground">Nothing here yet.</p> : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((v) => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
    </AppShell>
  );
}
