import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MonitorOff,
  PhoneOff, Circle, Square, Loader2,
} from "lucide-react";

const Search = z.object({
  peer: z.string().uuid(),
  role: z.enum(["caller", "callee"]),
});

export const Route = createFileRoute("/_authenticated/call/$callId")({
  validateSearch: Search,
  component: CallRoom,
});

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

type Status = "initializing" | "ringing" | "connecting" | "connected" | "ended" | "error";

function CallRoom() {
  const { callId } = Route.useParams();
  const { peer, role } = Route.useSearch();
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const isCaller = role === "caller";

  // Keep a stable ref to end() without recreating the main effect.
  const endRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const cleanup = () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    const end = (announce = true) => {
      if (announce && channelRef.current && user) {
        channelRef.current.send({
          type: "broadcast",
          event: "hangup",
          payload: { from: user.id },
        });
      }
      cleanup();
      setStatus("ended");
    };
    endRef.current = () => end(true);

    (async () => {
      try {
        // 1. Get local media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        // 2. Create peer connection
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (e) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = e.streams[0];
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setStatus("connected");
          if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setStatus("ended");
          }
        };

        // 3. Signalling channel
        const channel = supabase.channel(`call:${callId}`, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice",
              payload: { from: user.id, candidate: e.candidate.toJSON() },
            });
          }
        };

        channel
          .on("broadcast", { event: "offer" }, async ({ payload }) => {
            if (payload.from === user.id) return;
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { from: user.id, sdp: pc.localDescription },
            });
            setStatus("connecting");
          })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            if (payload.from === user.id) return;
            if (!pc.currentRemoteDescription) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            }
          })
          .on("broadcast", { event: "ice" }, async ({ payload }) => {
            if (payload.from === user.id) return;
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.warn("ICE add failed", err);
            }
          })
          .on("broadcast", { event: "callee-ready" }, async ({ payload }) => {
            if (payload.from === user.id || !isCaller) return;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "offer",
              payload: { from: user.id, sdp: pc.localDescription },
            });
            setStatus("connecting");
          })
          .on("broadcast", { event: "declined" }, () => {
            toast.error("Call declined");
            end(false);
          })
          .on("broadcast", { event: "hangup" }, () => {
            toast.message("Call ended by the other party");
            end(false);
          })
          .subscribe(async (subStatus) => {
            if (subStatus !== "SUBSCRIBED") return;
            if (isCaller) {
              // Ring the friend via their personal channel
              setStatus("ringing");
              const ringChannel = supabase.channel(`user:${peer}`);
              await ringChannel.subscribe();
              await ringChannel.send({
                type: "broadcast",
                event: "incoming-call",
                payload: {
                  callId,
                  from: user.id,
                  fromName: profile?.name ?? user.email ?? "Someone",
                },
              });
              supabase.removeChannel(ringChannel);
            } else {
              // Callee: announce readiness so caller sends the offer
              channel.send({
                type: "broadcast",
                event: "callee-ready",
                payload: { from: user.id },
              });
              setStatus("connecting");
            }
          });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to start call");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, callId, peer, isCaller]);

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track && !sharing) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  };

  const toggleShare = async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) return;

    if (!sharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        screenStreamRef.current = screen;
        const screenTrack = screen.getVideoTracks()[0];
        await sender.replaceTrack(screenTrack);
        if (localVideoRef.current) localVideoRef.current.srcObject = screen;
        setSharing(true);
        screenTrack.onended = () => stopShare();
      } catch (err) {
        console.error(err);
      }
    } else {
      stopShare();
    }
  };

  const stopShare = async () => {
    const pc = pcRef.current;
    const cam = cameraTrackRef.current;
    if (!pc || !cam) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(cam);
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setSharing(false);
  };

  const toggleRecord = () => {
    const remote = remoteVideoRef.current?.srcObject as MediaStream | null;
    if (!remote) { toast.error("Waiting for the other participant"); return; }
    if (!recording) {
      recordedChunksRef.current = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(remote, { mimeType: "video/webm;codecs=vp9,opus" });
      } catch {
        recorder = new MediaRecorder(remote);
      }
      recorder.ondataavailable = (e) => e.data.size > 0 && recordedChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `call-${callId}.webm`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      toast.success("Recording started");
    } else {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setRecording(false);
      toast.success("Recording saved");
    }
  };

  const hangup = () => {
    endRef.current();
    navigate({ to: "/friends" });
  };

  const statusLabel = useMemo(() => ({
    initializing: "Requesting camera and microphone…",
    ringing: "Ringing friend…",
    connecting: "Connecting…",
    connected: "Connected",
    ended: "Call ended",
    error: error ?? "Call error",
  } satisfies Record<Status, string>)[status], [status, error]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Video call</h1>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {status !== "connected" && status !== "ended" && status !== "error" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {statusLabel}
            </p>
          </div>
          {recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-500">
              <Circle className="h-2 w-2 animate-pulse fill-current" /> REC
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="aspect-video w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              Friend
            </span>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video ref={localVideoRef} autoPlay playsInline muted className="aspect-video w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
              You{sharing ? " · Sharing screen" : ""}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border p-3">
          <Button variant={micOn ? "secondary" : "destructive"} onClick={toggleMic} disabled={status === "ended"}>
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button variant={camOn ? "secondary" : "destructive"} onClick={toggleCam} disabled={status === "ended" || sharing}>
            {camOn ? <VideoIcon className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button variant={sharing ? "default" : "secondary"} onClick={toggleShare} disabled={status === "ended"}>
            {sharing ? <MonitorOff className="mr-2 h-4 w-4" /> : <MonitorUp className="mr-2 h-4 w-4" />}
            {sharing ? "Stop share" : "Share screen"}
          </Button>
          <Button variant={recording ? "default" : "secondary"} onClick={toggleRecord} disabled={status === "ended"}>
            {recording ? <Square className="mr-2 h-4 w-4" /> : <Circle className="mr-2 h-4 w-4" />}
            {recording ? "Stop recording" : "Record"}
          </Button>
          <Button variant="destructive" onClick={hangup}>
            <PhoneOff className="mr-2 h-4 w-4" /> Hang up
          </Button>
        </div>

        {status === "error" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            {error}
          </div>
        )}
      </div>
    </AppShell>
  );
}
