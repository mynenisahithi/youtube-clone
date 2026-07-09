import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThumbsUp, ThumbsDown, Languages, Loader2 } from "lucide-react";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/format";
import { translateComment } from "@/lib/translate.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function CommentsSection({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const translate = useServerFn(translateComment);

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", videoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, profiles!comments_user_id_fkey(name,avatar_url,city)")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to comment");
      const { error } = await supabase.from("comments").insert({ video_id: videoId, user_id: user.id, content: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["comments", videoId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const voteMut = useMutation({
    mutationFn: async ({ id, field, current }: { id: string; field: "likes" | "dislikes"; current: number }) => {
      const patch = field === "likes" ? { likes: current + 1 } : { dislikes: current + 1 };
      const { error } = await supabase.from("comments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", videoId] }),
  });

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const doTranslate = async (id: string, content: string) => {
    setBusy(id);
    try {
      const target = profile?.preferred_language || navigator.language.split("-")[0] || "en";
      const { translation } = await translate({ data: { text: content, targetLanguage: target } });
      setTranslations((m) => ({ ...m, [id]: translation }));
    } catch (e: any) { toast.error(e.message ?? "Translation failed"); }
    finally { setBusy(null); }
  };

  return (
    <section id="comments" className="mt-6">
      <h2 className="mb-4 text-lg font-semibold">{comments.length} Comments</h2>

      {user ? (
        <div className="mb-6 flex gap-3">
          <Avatar className="h-9 w-9 shrink-0"><AvatarFallback>{(profile?.name || "U").slice(0, 1)}</AvatarFallback></Avatar>
          <div className="flex-1">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" rows={2} />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setText("")}>Cancel</Button>
              <Button disabled={!text.trim() || addMut.isPending} onClick={() => addMut.mutate()}>Comment</Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted-foreground">
          <Link to="/auth" className="text-brand underline">Sign in</Link> to leave a comment.
        </p>
      )}

      <div className="space-y-5">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback>{(c.profiles?.name || "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium">{c.profiles?.name || "User"}</span>
                <span className="text-xs text-muted-foreground">{c.profiles?.city || "Unknown"} · {timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
              {translations[c.id] && (
                <p className="mt-1 rounded-md bg-muted p-2 text-sm italic">↳ {translations[c.id]}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => voteMut.mutate({ id: c.id, field: "likes", current: c.likes })}>
                  <ThumbsUp className="h-4 w-4" /> {c.likes}
                </button>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => voteMut.mutate({ id: c.id, field: "dislikes", current: c.dislikes })}>
                  <ThumbsDown className="h-4 w-4" /> {c.dislikes}
                </button>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => doTranslate(c.id, c.content)} disabled={busy === c.id}>
                  {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />} Translate
                </button>
              </div>
            </div>
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
      </div>
    </section>
  );
}
