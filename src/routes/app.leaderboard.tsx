import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { useAuth } from "@/hooks/use-auth";
import { Trophy } from "lucide-react";

type Range = "all" | "month" | "week";

export const Route = createFileRoute("/app/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", range],
    queryFn: async () => {
      if (range === "all") {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, total_points")
          .order("total_points", { ascending: false })
          .limit(100);
        return (data ?? []).map((p) => ({
          id: p.id,
          name: p.full_name,
          points: p.total_points,
        }));
      }
      const since = new Date();
      if (range === "week") since.setDate(since.getDate() - 7);
      else since.setMonth(since.getMonth() - 1);
      const { data: rows } = await supabase
        .from("attendance")
        .select("student_id, points_awarded")
        .gte("scanned_at", since.toISOString());
      const agg = new Map<string, number>();
      for (const row of rows ?? []) {
        agg.set(row.student_id, (agg.get(row.student_id) ?? 0) + row.points_awarded);
      }
      const ids = Array.from(agg.keys());
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return Array.from(agg.entries())
        .map(([id, points]) => ({ id, name: nameById.get(id) ?? "—", points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 100);

    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" /> Leaderboard
        </h1>
      </div>

      <div className="flex gap-1 p-1 glass rounded-xl w-fit">
        {(["all", "month", "week"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-lg text-sm capitalize ${
              range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {r === "all" ? "All time" : r === "month" ? "This month" : "This week"}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <Loader />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          {data.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No scores yet for this range.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {data.map((row, i) => {
                const isMe = row.id === user?.id;
                return (
                  <li
                    key={row.id}
                    className={`flex items-center justify-between px-4 py-3 ${
                      isMe ? "bg-primary/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 text-center font-bold ${
                          i < 3 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="font-medium text-sm">
                        {row.name} {isMe && <span className="text-xs text-primary ml-1">(you)</span>}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{row.points} pts</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
