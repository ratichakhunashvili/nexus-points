import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, QrCode, Trophy, History, Award, LayoutDashboard, Users, BarChart3, CalendarPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/hooks/use-auth";

const studentNav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard },
  { to: "/app/scan", label: "Scan QR", icon: QrCode },
  { to: "/app/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/achievements", label: "Achievements", icon: Award },
];

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/activities", label: "Activities", icon: CalendarPlus },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export function AppShell({
  role,
  children,
  title,
}: {
  role: AppRole;
  children: React.ReactNode;
  title?: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = role === "admin" ? adminNav : studentNav;

  return (
    <div className="min-h-screen flex w-full">
      <aside className="hidden md:flex w-64 shrink-0 flex-col glass m-3 rounded-2xl p-4">
        <div className="px-2 py-3">
          <div className="text-xl font-bold text-gradient">SkillBoard</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {role === "admin" ? "Admin Console" : "Student Portal"}
          </div>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = path === item.to || (item.to !== "/app" && item.to !== "/admin" && path.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                  active
                    ? "bg-primary/15 text-primary glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            window.location.href = "/auth";
          }}
          className="mt-auto flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-white/5"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 p-4 md:p-8 min-w-0">
        {title && (
          <header className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
          </header>
        )}
        {/* mobile nav */}
        <nav className="md:hidden glass rounded-2xl p-2 flex gap-1 overflow-x-auto mb-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-[10px] whitespace-nowrap",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </main>
    </div>
  );
}
