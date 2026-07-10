import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Play, Pause, FastForward, Rewind, MessageSquare, SkipForward } from "lucide-react";

interface Props {
  src: string;
  poster?: string;
  limitSec: number; // Infinity for unlimited
  nextVideoId?: string;
  onOpenComments: () => void;
  onLimitReached: () => void;
}

type Gesture = "play" | "pause" | "forward" | "backward" | "next" | "comments" | "close" | null;

export function GesturePlayer({ src, poster, limitSec, nextVideoId, onOpenComments, onLimitReached }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [gesture, setGesture] = useState<Gesture>(null);
  const tapTimes = useRef<{ side: "L" | "C" | "R"; t: number }[]>([]);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const [limitHit, setLimitHit] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);


  const flash = (g: Gesture) => {
    setGesture(g);
    setTimeout(() => setGesture(null), 500);
  };

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onTime = () => {
      if (limitSec !== Infinity && v.currentTime >= limitSec && !limitHit) {
        v.pause();
        setLimitHit(true);
        onLimitReached();
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [limitSec, limitHit, onLimitReached]);

  const handleTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = ref.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    const side: "L" | "C" | "R" = x < third ? "L" : x < 2 * third ? "C" : "R";
    const now = Date.now();

    tapTimes.current = tapTimes.current.filter((t) => now - t.t < 400 && t.side === side);
    tapTimes.current.push({ side, t: now });
    const count = tapTimes.current.length;

    if (count === 3) {
      tapTimes.current = [];
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      if (side === "C") {
        // next video
        if (nextVideoId) { flash("next"); navigate({ to: "/watch/$id", params: { id: nextVideoId } }); }
      } else if (side === "L") {
        flash("comments"); onOpenComments();
      } else {
        flash("close");
        if (confirm("Close this tab?")) window.close();
      }
      return;
    }

    if (count === 2) {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      if (side === "R") { v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10); flash("forward"); }
      else if (side === "L") { v.currentTime = Math.max(0, v.currentTime - 10); flash("backward"); }
      // wait for possible triple tap
      singleTapTimer.current = setTimeout(() => { tapTimes.current = []; }, 400);
      return;
    }

    if (count === 1 && side === "C") {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = setTimeout(() => {
        if (v.paused) { v.play(); flash("play"); } else { v.pause(); flash("pause"); }
        tapTimes.current = [];
      }, 300);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        key={reloadKey}
        ref={ref}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onError={() => setLoadError(true)}
        onLoadedData={() => setLoadError(false)}
        className="aspect-video w-full"
      />
      {/* Gesture layer covers only the top portion so native controls stay clickable */}
      <div
        className="pointer-events-auto absolute inset-x-0 top-0 h-[calc(100%-56px)]"
        onPointerDown={handleTap}
      />
      {gesture && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="animate-in fade-in zoom-in duration-200 rounded-full bg-black/70 p-6 text-white">
            {gesture === "play" && <Play className="h-10 w-10" />}
            {gesture === "pause" && <Pause className="h-10 w-10" />}
            {gesture === "forward" && <FastForward className="h-10 w-10" />}
            {gesture === "backward" && <Rewind className="h-10 w-10" />}
            {gesture === "next" && <SkipForward className="h-10 w-10" />}
            {gesture === "comments" && <MessageSquare className="h-10 w-10" />}
            {gesture === "close" && <span className="text-sm font-semibold">Closing…</span>}
          </div>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 grid place-items-center bg-black/85 p-4 text-center text-white">
          <div className="max-w-sm space-y-3">
            <p className="text-base font-medium">This video can't be played right now.</p>
            <p className="text-sm text-white/70">
              The source may be unavailable or blocked by your network.
            </p>
            <button
              onClick={() => { setLoadError(false); setReloadKey((k) => k + 1); }}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

