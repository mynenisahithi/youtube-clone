import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneIncoming, PhoneOff } from "lucide-react";

interface IncomingCall {
  callId: string;
  from: string;
  fromName: string;
}

/**
 * Global listener that subscribes to `user:<myId>` Realtime channel and shows
 * a ringing dialog when a friend broadcasts an `incoming-call` event.
 */
export function IncomingCallProvider() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user:${user.id}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "incoming-call" }, ({ payload }) => {
        setIncoming(payload as IncomingCall);
      })
      .on("broadcast", { event: "call-cancelled" }, () => {
        setIncoming(null);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const accept = async () => {
    if (!incoming) return;
    const call = incoming;
    setIncoming(null);
    navigate({
      to: "/call/$callId",
      params: { callId: call.callId },
      search: { peer: call.from, role: "callee" as const },
    });
  };

  const decline = async () => {
    if (!incoming || !user) return;
    const callChannel = supabase.channel(`call:${incoming.callId}`);
    await callChannel.subscribe();
    await callChannel.send({ type: "broadcast", event: "declined", payload: { from: user.id } });
    supabase.removeChannel(callChannel);
    setIncoming(null);
  };

  return (
    <Dialog open={!!incoming} onOpenChange={(v) => !v && decline()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneIncoming className="h-5 w-5 animate-pulse text-brand" />
            Incoming call
          </DialogTitle>
          <DialogDescription>
            <b>{incoming?.fromName ?? "A friend"}</b> is calling you.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="destructive" onClick={decline}>
            <PhoneOff className="mr-2 h-4 w-4" /> Decline
          </Button>
          <Button onClick={accept} className="bg-brand text-brand-foreground hover:bg-brand/90">
            <PhoneIncoming className="mr-2 h-4 w-4" /> Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
