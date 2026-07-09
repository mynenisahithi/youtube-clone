import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDuration, formatViews, timeAgo } from "@/lib/format";

export interface VideoRow {
  id: string;
  title: string;
  channel_name: string;
  channel_avatar: string | null;
  thumbnail_url: string;
  duration_seconds: number;
  views: number;
  created_at: string;
}

export function VideoCard({ v }: { v: VideoRow }) {
  return (
    <Link to="/watch/$id" params={{ id: v.id }} className="group flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <img
          src={v.thumbnail_url}
          alt={v.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(v.duration_seconds)}
        </span>
      </div>
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={v.channel_avatar ?? undefined} />
          <AvatarFallback>{v.channel_name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-medium leading-snug">{v.title}</h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">{v.channel_name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {formatViews(v.views)} views · {timeAgo(v.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
