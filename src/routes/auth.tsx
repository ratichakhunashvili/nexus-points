import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthSearch = { next?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign in — SkillBoard Activities" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, role, loading } = useAuth();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      // Prefer explicit ?next=, then any pending scan code from sessionStorage
      let target = next;
      if (!target) {
        try {
          const code = sessionStorage.getItem("pending_scan_code");
          if (code) target = `/scan?code=${encodeURIComponent(code)}`;
        } catch {
          /* ignore */
        }
      }
      if (target) {
        window.location.replace(target);
        return;
      }
      navigate({ to: role === "admin" ? "/admin" : "/app" });
    }
  }, [user, role, loading, navigate, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can now sign in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }


  async function oauth(provider: "google" | "apple") {
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${provider} sign-in failed`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gradient">SkillBoard</div>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => oauth("google")}
            className="glass rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition flex items-center justify-center gap-2"
          >
            <GoogleIcon /> Google
          </button>
          <button
            type="button"
            onClick={() => oauth("apple")}
            className="glass rounded-xl py-2.5 text-sm font-medium hover:bg-accent transition flex items-center justify-center gap-2"
          >
            <AppleIcon /> Apple
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground my-4">
          <span className="flex-1 h-px bg-border" /> or with email <span className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-1 p-1 glass rounded-xl mb-6">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm rounded-lg transition ${
                mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            required
            type="password"
            placeholder="Password (min 6 chars)"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full glass rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            disabled={busy}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-medium glow hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5">
          <button
            onClick={seedDemo}
            disabled={seeding}
            className="w-full glass rounded-xl py-2.5 text-sm hover:bg-white/10 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {seeding && <Loader2 className="h-4 w-4 animate-spin" />}
            Create demo accounts
          </button>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Seeds <code>admin@demo.test</code> and <code>student@demo.test</code> with password{" "}
            <code>demo1234</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.4 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.9 6.4 29.2 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 43.5c5.2 0 9.8-1.9 13.3-5l-6.1-5c-2 1.4-4.5 2.3-7.2 2.3-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39 16.3 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.1 5c-.4.4 6.7-4.9 6.7-14.5 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.46 2.22-1.21 3.02-.82.87-2.16 1.55-3.27 1.46-.13-1.12.42-2.27 1.18-3.05.83-.86 2.27-1.5 3.3-1.43zM20.5 17.27c-.55 1.27-.81 1.84-1.52 2.97-1 1.57-2.41 3.53-4.15 3.54-1.55.02-1.95-1-4.05-.99-2.1.01-2.54 1.01-4.09.99-1.74-.02-3.07-1.78-4.07-3.35C.04 16.66-.27 11.42 1.7 8.6c1.39-2 3.58-3.18 5.65-3.18 2.1 0 3.42 1.16 5.16 1.16 1.69 0 2.72-1.16 5.15-1.16 1.84 0 3.79.99 5.18 2.7-4.55 2.49-3.81 9.04-2.34 9.15z"/>
    </svg>
  );
}

