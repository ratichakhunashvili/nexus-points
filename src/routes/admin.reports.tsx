import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { Download, Calendar, CalendarPlus, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — SkillBoard Admin" }] }),
  component: ReportsPage,
});

type Mode = "activity" | "range";

function ReportsPage() {
  const [mode, setMode] = useState<Mode>("activity");
  const [activityId, setActivityId] = useState<string>("");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["admin-activities-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("id, name, event_date, points")
        .order("event_date", { ascending: false });
      return data ?? [];
    },
  });

  async function exportXlsx() {
    setBusy(true);
    try {
      let query = supabase
        .from("attendance")
        .select("id, scanned_at, points_awarded, student_id, activities(name, event_date, points)")
        .order("scanned_at", { ascending: false });

      let label = "attendance";
      if (mode === "activity") {
        if (!activityId) {
          toast.error("Pick an activity");
          setBusy(false);
          return;
        }
        query = query.eq("activity_id", activityId);
        const a = activities?.find((x) => x.id === activityId);
        label = `attendance-${(a?.name ?? "activity").replace(/[^\w-]+/g, "_")}`;
      } else {
        const fromIso = new Date(from + "T00:00:00").toISOString();
        const toIso = new Date(to + "T23:59:59").toISOString();
        query = query.gte("scanned_at", fromIso).lte("scanned_at", toIso);
        label = `attendance-${from}_to_${to}`;
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];

      if (rows.length === 0) {
        toast.message("No scans found for this selection");
        setBusy(false);
        return;
      }

      // Fetch profile info for the students in this set
      const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, student_id, department")
        .in("id", studentIds);
      const pMap = new Map((profs ?? []).map((p) => [p.id, p]));

      const flat = rows.map((r) => {
        const p = pMap.get(r.student_id);
        return {
          "Scanned At": new Date(r.scanned_at).toLocaleString(),
          "Activity": r.activities?.name ?? "—",
          "Event Date": r.activities?.event_date ?? "—",
          "Student": p?.full_name ?? "—",
          "Email": p?.email ?? "—",
          "Student ID": p?.student_id ?? "",
          "Department": p?.department ?? "",
          "Points Awarded": r.points_awarded,
        };
      });

      // Per-student summary
      const summaryMap = new Map<string, { name: string; email: string; scans: number; points: number }>();
      for (const r of rows) {
        const p = pMap.get(r.student_id);
        const key = r.student_id;
        const cur = summaryMap.get(key) ?? {
          name: p?.full_name ?? "—",
          email: p?.email ?? "—",
          scans: 0,
          points: 0,
        };
        cur.scans += 1;
        cur.points += r.points_awarded;
        summaryMap.set(key, cur);
      }
      const summary = Array.from(summaryMap.values())
        .sort((a, b) => b.points - a.points)
        .map((s) => ({
          Student: s.name,
          Email: s.email,
          Scans: s.scans,
          "Total Points": s.points,
        }));

      const wb = XLSX.utils.book_new();
      const wsDetail = XLSX.utils.json_to_sheet(flat);
      const wsSummary = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
      XLSX.utils.book_append_sheet(wb, wsDetail, "Detail");
      XLSX.writeFile(wb, `${label}.xlsx`);
      toast.success(`Exported ${flat.length} scans`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <Loader />;

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Export attendance to Excel for one activity or a date range.
        </p>
      </header>

      <div className="flex gap-2">
        <ModeButton active={mode === "activity"} onClick={() => setMode("activity")} icon={<CalendarPlus className="h-4 w-4" />}>
          By activity
        </ModeButton>
        <ModeButton active={mode === "range"} onClick={() => setMode("range")} icon={<Calendar className="h-4 w-4" />}>
          By date range
        </ModeButton>
      </div>

      <section className="glass rounded-2xl p-6 space-y-4">
        {mode === "activity" ? (
          <label className="block">
            <span className="text-xs text-muted-foreground">Activity</span>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="mt-1 w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent"
            >
              <option value="">— Select an activity —</option>
              {activities?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.event_date} · {a.name} ({a.points} pts)
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-muted-foreground">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent"
              />
            </label>
          </div>
        )}

        <button
          onClick={exportXlsx}
          disabled={busy}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-sm font-medium glow hover:opacity-90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export to Excel (.xlsx)
        </button>
        <p className="text-xs text-muted-foreground">
          Includes a <strong>Summary</strong> sheet (per student totals) and a <strong>Detail</strong> sheet (one row per scan).
        </p>
      </section>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition ${
        active ? "bg-primary text-primary-foreground glow" : "glass hover:bg-accent"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
