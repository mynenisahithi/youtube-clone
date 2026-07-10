import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VideoCard, type VideoRow } from "@/components/VideoCard";
import { Button } from "@/components/ui/button";

const Search = z.object({ q: z.string().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: Search,
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      let query = supabase.from("videos").select("*").order("views", { ascending: false });
      if (q) query = query.or(`title.ilike.%${q}%,channel_name.ilike.%${q}%,category.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as VideoRow[];
    },
    retry: 1,
  });

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">
        {q ? <>Results for “<span className="text-brand">{q}</span>”</> : "Browse all videos"}
      </h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading videos…
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">
            Something went wrong loading videos.
            {error instanceof Error ? ` (${error.message})` : ""}
          </p>
          <Button onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">No videos found for this category yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((v) => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
    </AppShell>
  );
}
