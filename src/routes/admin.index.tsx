import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { Users, Calendar, Trophy, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-home"],
    queryFn: async () => {
      const [students, activities, attendance, totalPoints] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("activities").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("total_points"),
      ]);
      const total = (totalPoints.data ?? []).reduce(
        (a, b) => a + (b.total_points ?? 0),
        0,
      );
      return {
        students: students.count ?? 0,
        activities: activities.count ?? 0,
        attendance: attendance.count ?? 0,
        total,
      };
    },
  });

  if (isLoading || !data) return <Loader />;

  const stats = [
    { label: "Students", value: data.students, icon: Users },
    { label: "Activities", value: data.activities, icon: Calendar },
    { label: "Scans", value: data.attendance, icon: Activity },
    { label: "Points awarded", value: data.total, icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm">Manage activities, students and analytics.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <s.icon className="h-5 w-5 text-primary" />
            <div className="mt-3 text-3xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Link to="/admin/activities" className="glass rounded-2xl p-5 hover:bg-white/10 transition">
          <div className="font-semibold">Create activity</div>
          <div className="text-xs text-muted-foreground mt-1">
            Add a new event and generate its QR code.
          </div>
        </Link>
        <Link to="/admin/students" className="glass rounded-2xl p-5 hover:bg-white/10 transition">
          <div className="font-semibold">Manage students</div>
          <div className="text-xs text-muted-foreground mt-1">
            View profiles, award bonus points.
          </div>
        </Link>
        <Link to="/admin/analytics" className="glass rounded-2xl p-5 hover:bg-white/10 transition">
          <div className="font-semibold">Analytics</div>
          <div className="text-xs text-muted-foreground mt-1">
            Attendance trends and top activities.
          </div>
        </Link>
      </div>
    </div>
  );
}
