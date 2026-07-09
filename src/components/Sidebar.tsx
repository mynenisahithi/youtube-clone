import { Link, useLocation } from "@tanstack/react-router";
import { Home, Flame, Music, Film, Gamepad2, Newspaper, Trophy, Lightbulb, Download, History, User, Crown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const main = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search, search: { q: "" } as { q: string } },
  { to: "/premium", label: "Premium", icon: Crown },
];
const you = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/history", label: "History", icon: History },
  { to: "/downloads", label: "Downloads", icon: Download },
];
const categories = [
  { label: "Trending", icon: Flame, q: "trending" },
  { label: "Music", icon: Music, q: "music" },
  { label: "Movies", icon: Film, q: "animation" },
  { label: "Gaming", icon: Gamepad2, q: "gaming" },
  { label: "News", icon: Newspaper, q: "news" },
  { label: "Sports", icon: Trophy, q: "sports" },
  { label: "Learning", icon: Lightbulb, q: "learning" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 overflow-y-auto border-r bg-background transition-transform lg:sticky",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-20"
        )}
      >
        <nav className="p-2">
          <Section items={main} loc={loc.pathname} collapsed={!open} />
          <div className={cn("my-2 border-t", !open && "lg:mx-2")} />
          <Section items={you} loc={loc.pathname} collapsed={!open} heading={open ? "You" : undefined} />
          {open && (
            <>
              <div className="my-2 border-t" />
              <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">Explore</div>
              {categories.map((c) => (
                <Link
                  key={c.label}
                  to="/search"
                  search={{ q: c.q }}
                  className="flex items-center gap-4 rounded-lg px-3 py-2 hover:bg-accent"
                >
                  <c.icon className="h-5 w-5" />
                  <span className="text-sm">{c.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}

function Section({ items, loc, collapsed, heading }: {
  items: { to: string; label: string; icon: any; search?: { q: string } }[];
  loc: string; collapsed: boolean; heading?: string;
}) {
  return (
    <div>
      {heading && <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">{heading}</div>}
      {items.map((i) => {
        const active = loc === i.to;
        return (
          <Link
            key={i.to}
            to={i.to}
            search={i.search}
            className={cn(
              "flex items-center gap-4 rounded-lg px-3 py-2 hover:bg-accent",
              active && "bg-accent font-medium",
              collapsed && "lg:flex-col lg:gap-1 lg:px-2 lg:py-3 lg:text-[10px]"
            )}
          >
            <i.icon className="h-5 w-5 shrink-0" />
            <span className={cn("text-sm", collapsed && "lg:text-[10px]")}>{i.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
