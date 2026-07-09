import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VideoCard, type VideoRow } from "@/components/VideoCard";

const Search = z.object({ q: z.string().default("") });

export const Route = createFileRoute("/search")({
  validateSearch: Search,
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const { data = [], isLoading } = useQuery({
    queryKey: ["search", q],
    queryFn: async () => {
      let query = supabase.from("videos").select("*").order("views", { ascending: false });
      if (q) query = query.or(`title.ilike.%${q}%,channel_name.ilike.%${q}%,category.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data as VideoRow[];
    },
  });

  return (
    <AppShell>
      <h1 className="mb-4 text-xl font-semibold">
        {q ? <>Results for “<span className="text-brand">{q}</span>”</> : "Browse all videos"}
      </h1>
      {isLoading ? <p className="text-muted-foreground">Searching…</p> : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((v) => <VideoCard key={v.id} v={v} />)}
          {data.length === 0 && <p className="col-span-full text-muted-foreground">No matches.</p>}
        </div>
      )}
    </AppShell>
  );
}
