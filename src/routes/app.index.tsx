import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/loader";
import { Trophy, Sparkles, Calendar, Award } from "lucide-react";
import { ActivitiesList } from "@/components/activities-list";

export const Route = createFileRoute("/app/")({
  component: StudentHome,
});

function StudentHome() {
  const { user } = useAuth();
  const uid = user?.id;

  const { data, isLoading } = useQuery({
    enabled: !!uid,
    queryKey: ["student-home", uid],
    queryFn: async () => {
      const [profile, attendance, achievements, leaderboard] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid!).maybeSingle(),
        supabase
          .from("attendance")
          .select("id, points_awarded, scanned_at, activities(name)")
          .eq("student_id", uid!)
          .order("scanned_at", { ascending: false })
          .limit(5),
        supabase.from("user_achievements").select("id").eq("user_id", uid!),
        supabase
          .from("profiles")
          .select("id, total_points")
          .order("total_points", { ascending: false }),
      ]);
      const rank =
        (leaderboard.data ?? []).findIndex((p) => p.id === uid) + 1 || null;
      return {
        profile: profile.data,
        attendance: attendance.data ?? [],
        achievementCount: achievements.data?.length ?? 0,
        rank,
        total: leaderboard.data?.length ?? 0,
      };
    },
  });

  if (isLoading || !data) return <Loader />;

  const stats = [
    { label: "Total Points", value: data.profile?.total_points ?? 0, icon: Sparkles },
    {
      label: "Global Rank",
      value: data.rank ? `#${data.rank}` : "—",
      sub: data.total ? `of ${data.total}` : "",
      icon: Trophy,
    },
    { label: "Achievements", value: data.achievementCount, icon: Award },
    { label: "Activities", value: data.attendance.length, icon: Calendar },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold">
          Hi, <span className="text-gradient">{data.profile?.full_name || "there"}</span>
        </h1>
        <p className="text-muted-foreground text-xs md:text-sm">Here's how you're doing.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-3 md:p-5">
            <s.icon className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <div className="mt-2 md:mt-3 text-2xl md:text-3xl font-bold">{s.value}</div>
            <div className="text-[11px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
              {s.label} {s.sub && <span>· {s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-3 md:p-6">
        <div className="font-semibold mb-3 flex items-center gap-2 text-sm md:text-base">
          <Calendar className="h-4 w-4 text-primary" /> Activities
        </div>
        <ActivitiesList />
      </div>

      <div className="glass rounded-2xl p-4 md:p-6">
        <div className="font-semibold mb-3 text-sm md:text-base">Recent activity</div>
        {data.attendance.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity yet — scan a QR code to earn your first points.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.attendance.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{a.activities?.name ?? "Activity"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.scanned_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-primary font-semibold shrink-0">+{a.points_awarded}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
