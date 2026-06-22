import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Sign in — SkillBoard Activities" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      navigate({ to: role === "admin" ? "/admin" : "/app" });
    }
  }, [user, role, loading, navigate]);

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

  async function seedDemo() {
    setSeeding(true);
    try {
      const res = await fetch("/api/public/seed-demo", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Seed failed");
      toast.success("Demo accounts ready. Try admin@demo.test / demo1234");
      setEmail("admin@demo.test");
      setPassword("demo1234");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Seed failed";
      toast.error(message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md glass rounded-3xl p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-bold text-gradient">SkillBoard</div>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
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
