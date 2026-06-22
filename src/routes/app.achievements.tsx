import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/loader";
import { Award, Sparkles, Star, Trophy, Medal, Heart, Compass } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  star: Star,
  trophy: Trophy,
  medal: Medal,
  heart: Heart,
  compass: Compass,
};

export const Route = createFileRoute("/app/achievements")({
  component: AchievementsPage,
});

function AchievementsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["achievements", user?.id],
    queryFn: async () => {
      const [all, mine, profile, attendance] = await Promise.all([
        supabase.from("achievements").select("*"),
        supabase.from("user_achievements").select("achievement_id").eq("user_id", user!.id),
        supabase.from("profiles").select("total_points").eq("id", user!.id).maybeSingle(),
        supabase.from("attendance").select("activity_id").eq("student_id", user!.id),
      ]);
      const earned = new Set((mine.data ?? []).map((m) => m.achievement_id));
      const points = profile.data?.total_points ?? 0;
      const attended = (attendance.data ?? []).length;
      const distinct = new Set((attendance.data ?? []).map((a) => a.activity_id)).size;

      // Auto-unlock based on thresholds (display only; persistence is best-effort)
      const list = (all.data ?? []).map((a) => {
        let unlocked = earned.has(a.id);
        if (!unlocked) {
          if (a.code === "first_activity" && attended >= 1) unlocked = true;
          if (a.code === "points_100" && points >= 100) unlocked = true;
          if (a.code === "points_500" && points >= 500) unlocked = true;
          if (a.code === "volunteer_champion" && attended >= 10) unlocked = true;
          if (a.code === "event_explorer" && distinct >= 5) unlocked = true;
        }
        return { ...a, unlocked };
      });
      // persist newly unlocked
      const newly = list.filter((a) => a.unlocked && !earned.has(a.id) && a.code !== "top_10");
      if (newly.length) {
        await supabase
          .from("user_achievements")
          .upsert(
            newly.map((a) => ({ user_id: user!.id, achievement_id: a.id })),
            { onConflict: "user_id,achievement_id" },
          );
      }
      return list;
    },
  });

  if (isLoading || !data) return <Loader />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Award className="h-6 w-6 text-primary" /> Achievements
      </h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((a) => {
          const Icon = iconMap[a.icon ?? "star"] ?? Star;
          return (
            <div
              key={a.id}
              className={`glass rounded-2xl p-5 transition ${
                a.unlocked ? "glow" : "opacity-50"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  a.unlocked ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div className="mt-3 font-semibold">{a.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
              <div className="text-[11px] mt-3 uppercase tracking-wide">
                {a.unlocked ? (
                  <span className="text-primary">Unlocked</span>
                ) : (
                  <span className="text-muted-foreground">Locked</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
