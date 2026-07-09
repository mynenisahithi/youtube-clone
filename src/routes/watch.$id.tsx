import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { GesturePlayer } from "@/components/GesturePlayer";
import { CommentsSection } from "@/components/CommentsSection";
import { VideoCard, type VideoRow } from "@/components/VideoCard";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { PLANS, canDownload } from "@/lib/plan-limits";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { formatViews, timeAgo } from "@/lib/format";
import { Download, ThumbsUp, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/watch/$id")({ component: Watch });

function Watch() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: video } = useQuery({
    queryKey: ["video", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as VideoRow & { description: string; video_url: string };
    },
  });

  const { data: related = [] } = useQuery({
    queryKey: ["related", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("videos").select("*").neq("id", id).limit(12);
      if (error) throw error;
      return data as VideoRow[];
    },
  });

  // History
  useEffect(() => {
    if (user && video) {
      supabase.from("history").insert({ user_id: user.id, video_id: video.id }).then(() => {});
    }
  }, [user, video]);

  const { data: todayDownloads = 0 } = useQuery({
    queryKey: ["dl-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from("downloads").select("*", { count: "exact", head: true })
        .eq("user_id", user!.id).gte("created_at", start.toISOString());
      return count ?? 0;
    },
  });

  const dlMut = useMutation({
    mutationFn: async () => {
      if (!user || !profile || !video) throw new Error("Sign in first");
      if (!canDownload(profile.plan, todayDownloads)) throw new Error("Daily download limit reached. Upgrade to Silver or Gold.");
      await supabase.from("downloads").insert({ user_id: user.id, video_id: video.id });
      const a = document.createElement("a");
      a.href = video.video_url; a.download = `${video.title}.mp4`; a.target = "_blank";
      document.body.appendChild(a); a.click(); a.remove();
    },
    onSuccess: () => { toast.success("Download started"); qc.invalidateQueries({ queryKey: ["dl-count"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const likeMut = useMutation({
    mutationFn: async () => {
      if (!user || !video) throw new Error("Sign in first");
      await supabase.from("video_likes").upsert({ user_id: user.id, video_id: video.id });
    },
    onSuccess: () => toast.success("Added to Liked videos"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!video) {
    return <AppShell><div className="grid h-64 place-items-center text-muted-foreground">Loading…</div></AppShell>;
  }

  const plan = profile?.plan ?? "free";
  const limit = PLANS[plan].limitSec;

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <GesturePlayer
            src={video.video_url}
            poster={video.thumbnail_url}
            limitSec={limit}
            nextVideoId={related[0]?.id}
            onOpenComments={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" })}
            onLimitReached={() => setShowUpgrade(true)}
          />
          <h1 className="mt-4 text-xl font-semibold">{video.title}</h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar><AvatarImage src={video.channel_avatar ?? undefined} /><AvatarFallback>{video.channel_name.slice(0,1)}</AvatarFallback></Avatar>
              <div>
                <p className="font-medium">{video.channel_name}</p>
                <p className="text-xs text-muted-foreground">{formatViews(video.views)} views · {timeAgo(video.created_at)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => likeMut.mutate()}><ThumbsUp className="mr-2 h-4 w-4" />Like</Button>
              <Button variant="secondary" onClick={() => dlMut.mutate()} disabled={dlMut.isPending}>
                <Download className="mr-2 h-4 w-4" />Download
              </Button>
              {plan !== "gold" && (
                <Button asChild variant="default" className="bg-brand text-brand-foreground hover:bg-brand/90">
                  <Link to="/premium"><Crown className="mr-2 h-4 w-4" />Upgrade</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
            <Badge variant="secondary" className="mb-2">{video.category}</Badge>
            <p className="whitespace-pre-wrap text-muted-foreground">{video.description || "No description."}</p>
          </div>

          <CommentsSection videoId={video.id} />
        </div>

        <aside className="space-y-4">
          <h2 className="text-lg font-semibold">Up next</h2>
          <div className="flex flex-col gap-4">
            {related.slice(0, 8).map((v) => <VideoCard key={v.id} v={v} />)}
          </div>
        </aside>
      </div>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-brand" />Watch limit reached</DialogTitle>
            <DialogDescription>
              You're on the <b>{PLANS[plan].name}</b> plan ({Math.floor(limit / 60)} min limit). Upgrade to continue watching.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUpgrade(false)}>Maybe later</Button>
            <Button onClick={() => navigate({ to: "/premium" })} className="bg-brand text-brand-foreground hover:bg-brand/90">
              See plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
