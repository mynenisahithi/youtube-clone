import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { VideoCard, type VideoRow } from "@/components/VideoCard";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Home,
});

const CATEGORIES = ["All", "Animation", "Tech", "Music", "Cars", "Sci-Fi"];

function Home() {
  const [cat, setCat] = useState("All");
  const { data = [], isLoading } = useQuery({
    queryKey: ["videos", cat],
    queryFn: async () => {
      let q = supabase.from("videos").select("*").order("created_at", { ascending: false });
      if (cat !== "All") q = q.eq("category", cat);
      const { data, error } = await q;
      if (error) throw error;
      return data as VideoRow[];
    },
  });

  return (
    <AppShell>
      <div className="mb-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors",
              cat === c ? "bg-foreground text-background" : "bg-muted/50 hover:bg-muted"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-xl bg-muted" />
              <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((v) => <VideoCard key={v.id} v={v} />)}
        </div>
      )}
    </AppShell>
  );
}
