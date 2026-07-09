import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VideoCard, type VideoRow } from "@/components/VideoCard";

export const Route = createFileRoute("/_authenticated/downloads")({ component: DownloadsPage });

function DownloadsPage() {
  const { user } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["downloads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("downloads")
        .select("videos(*)").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => r.videos as VideoRow).filter(Boolean);
    },
  });
  return (
    <AppShell>
      <h1 className="mb-6 text-xl font-semibold">Your downloads</h1>
      {data.length === 0 ? <p className="text-muted-foreground">No downloads yet.</p> : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((v) => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
    </AppShell>
  );
}
