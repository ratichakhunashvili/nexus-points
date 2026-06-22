import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [attendance, activities] = await Promise.all([
        supabase.from("attendance").select("activity_id, scanned_at, points_awarded"),
        supabase.from("activities").select("id, name"),
      ]);
      const nameById = new Map((activities.data ?? []).map((a) => [a.id, a.name]));

      // last 14 days scans
      const days = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.set(d.toISOString().slice(0, 10), 0);
      }
      for (const a of attendance.data ?? []) {
        const k = a.scanned_at.slice(0, 10);
        if (days.has(k)) days.set(k, (days.get(k) ?? 0) + 1);
      }
      const trend = Array.from(days.entries()).map(([day, scans]) => ({
        day: day.slice(5),
        scans,
      }));

      // top activities
      const perAct = new Map<string, number>();
      for (const a of attendance.data ?? []) {
        perAct.set(a.activity_id, (perAct.get(a.activity_id) ?? 0) + 1);
      }
      const top = Array.from(perAct.entries())
        .map(([id, count]) => ({ name: nameById.get(id) ?? "—", count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return { trend, top };
    },
  });

  if (isLoading || !data) return <Loader />;

  const colors = ["#34d399", "#22d3ee", "#a78bfa", "#facc15", "#fb7185"];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5">
          <div className="font-semibold mb-3">Scans — last 14 days</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,30,25,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="scans" fill="#34d399" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="font-semibold mb-3">Top activities by attendance</div>
          {data.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.top}
                    dataKey="count"
                    nameKey="name"
                    outerRadius={90}
                    label={(d) => d.name}
                  >
                    {data.top.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15,30,25,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
