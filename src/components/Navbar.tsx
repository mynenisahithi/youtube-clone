import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, Mic, Bell, Sun, Moon, Video, User as UserIcon, LogOut, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { useAuth, useProfile } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Badge } from "@/components/ui/badge";

export function Navbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();
  const { theme, toggle } = useTheme();

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
  };

  const voiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Voice search not supported in this browser"); return; }
    const r = new SR();
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setQ(text);
      navigate({ to: "/search", search: { q: text } });
    };
    r.start();
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-2 sm:px-4">
      <Button variant="ghost" size="icon" onClick={onMenuClick} aria-label="Menu">
        <Menu className="h-5 w-5" />
      </Button>
      <Link to="/" className="flex items-center gap-1">
        <div className="grid h-7 w-10 place-items-center rounded-md bg-brand text-brand-foreground">
          <Video className="h-4 w-4" />
        </div>
        <span className="hidden text-lg font-bold tracking-tight sm:inline">MyTube</span>
      </Link>

      <form onSubmit={onSearch} className="mx-auto flex max-w-2xl flex-1 items-center gap-2">
        <div className="flex flex-1 items-center rounded-full border bg-muted/40 focus-within:ring-2 focus-within:ring-ring">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="border-0 bg-transparent focus-visible:ring-0"
          />
          <Button type="submit" variant="ghost" size="icon" className="rounded-full" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={voiceSearch} aria-label="Voice search" className="hidden sm:inline-flex">
          <Mic className="h-4 w-4" />
        </Button>
      </form>

      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
        <Bell className="h-4 w-4" />
      </Button>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback>{(profile?.name || user.email || "?").slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              {profile?.plan && profile.plan !== "free" && (
                <Badge variant="secondary" className="hidden gap-1 sm:inline-flex">
                  <Crown className="h-3 w-3" /> {profile.plan}
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild><Link to="/profile"><UserIcon className="mr-2 h-4 w-4" /> Profile</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/downloads">Downloads</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/history">History</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/premium"><Crown className="mr-2 h-4 w-4" /> Premium</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild size="sm" className="ml-1"><Link to="/auth">Sign in</Link></Button>
      )}
    </header>
  );
}
