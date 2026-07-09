import { useEffect, useState } from "react";

const SOUTH_STATES = ["Andhra Pradesh", "Telangana", "Karnataka", "Kerala", "Tamil Nadu"];

function computeAutoTheme(state: string | null): "light" | "dark" {
  if (!state || !SOUTH_STATES.includes(state)) return "dark";
  // Current IST time
  const now = new Date();
  const istHour = (now.getUTCHours() + 5) + Math.floor((now.getUTCMinutes() + 30) / 60);
  const hour = ((istHour % 24) + 24) % 24;
  return hour >= 10 && hour < 12 ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const state = localStorage.getItem("user_state");
    const initial = saved ?? computeAutoTheme(state);
    apply(initial);
    setTheme(initial);
  }, []);

  const apply = (t: "light" | "dark") => {
    document.documentElement.classList.toggle("dark", t === "dark");
  };

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    localStorage.setItem("theme", next);
  };

  return { theme, toggle };
}
