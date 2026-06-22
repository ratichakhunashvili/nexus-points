import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { QrCode, Trophy, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SkillBoard Activities — Reward students for showing up" },
      {
        name: "description",
        content:
          "QR-based attendance and points platform for universities, schools, clubs and organizations.",
      },
      { property: "og:title", content: "SkillBoard Activities" },
      {
        property: "og:description",
        content: "Reward students for participating in real-world activities.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "admin" ? "/admin" : "/app" });
    }
  }, [user, role, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between">
        <div className="text-xl font-bold text-gradient">SkillBoard</div>
        <Link
          to="/auth"
          className="glass px-4 py-2 rounded-xl text-sm hover:bg-white/10 transition"
        >
          Sign in
        </Link>
      </header>

      <section className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 glass px-3 py-1.5 rounded-full text-xs text-primary mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Built for universities, schools & clubs
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Reward students for{" "}
            <span className="text-gradient">showing up.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Generate secure QR codes for every activity. Students scan, earn points, climb the
            leaderboard, and unlock achievements — all in real time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium glow hover:opacity-90 transition"
            >
              Get started
            </Link>
            <a
              href="#features"
              className="glass px-6 py-3 rounded-xl font-medium hover:bg-white/10 transition"
            >
              See features
            </a>
          </div>
          <div className="mt-8 text-xs text-muted-foreground">
            Demo: <code className="text-primary">admin@demo.test</code> /{" "}
            <code className="text-primary">student@demo.test</code> — password{" "}
            <code className="text-primary">demo1234</code>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4" id="features">
          {[
            { icon: QrCode, title: "QR Attendance", desc: "Tap, scan, points awarded instantly." },
            { icon: Trophy, title: "Live Leaderboard", desc: "Weekly, monthly & all-time." },
            { icon: Sparkles, title: "Achievements", desc: "Auto-unlocked milestones." },
            { icon: ShieldCheck, title: "Role-secured", desc: "Students can't touch admin tools." },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <div className="mt-3 font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-6xl w-full mx-auto px-6 py-8 text-xs text-muted-foreground">
        SkillBoard Activities — © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
