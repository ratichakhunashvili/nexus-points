import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { toast } from "sonner";
import { Plus, QrCode, Trash2, Power, X, Download, Users, UserMinus } from "lucide-react";

export const Route = createFileRoute("/admin/activities")({
  component: ActivitiesPage,
});

type Activity = {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  points: number;
  max_scans_per_student: number;
  is_active: boolean;
};

function ActivitiesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [qrFor, setQrFor] = useState<Activity | null>(null);
  const [logFor, setLogFor] = useState<Activity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id,name,description,event_date,start_time,end_time,points,max_scans_per_student,is_active")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggle = useMutation({
    mutationFn: async (a: Activity) => {
      const { error } = await supabase
        .from("activities")
        .update({ is_active: !a.is_active })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Activities</h1>
          <p className="text-sm text-muted-foreground">Create activities and generate their QR codes.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium glow flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> New activity
        </button>
      </div>

      {isLoading || !data ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No activities yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((a) => (
            <div key={a.id} className="glass rounded-2xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{a.name}</div>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    a.is_active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.is_active ? "Active" : "Off"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {a.description}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {a.event_date} · {a.points} pts · max {a.max_scans_per_student} scan(s)
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setQrFor(a)}
                  className="glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-white/10"
                >
                  <QrCode className="h-3 w-3" /> QR
                </button>
                <button
                  onClick={() => setLogFor(a)}
                  className="glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-white/10"
                >
                  <Users className="h-3 w-3" /> Log
                </button>
                <button
                  onClick={() => {
                    setEditing(a);
                    setShowForm(true);
                  }}
                  className="glass rounded-lg px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggle.mutate(a)}
                  className="glass rounded-lg px-3 py-1.5 text-xs flex items-center gap-1 hover:bg-white/10"
                >
                  <Power className="h-3 w-3" /> {a.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${a.name}"?`)) del.mutate(a.id);
                  }}
                  className="glass rounded-lg px-3 py-1.5 text-xs text-destructive flex items-center gap-1 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <ActivityForm
          activity={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["activities"] });
          }}
        />
      )}
      {qrFor && <QrModal activity={qrFor} onClose={() => setQrFor(null)} />}
      {logFor && <LogModal activity={logFor} onClose={() => setLogFor(null)} />}
    </div>
  );
}

function LogModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-log", activity.id],
    queryFn: async () => {
      const { data: att, error } = await supabase
        .from("attendance")
        .select("id, student_id, points_awarded, scanned_at")
        .eq("activity_id", activity.id)
        .order("scanned_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((att ?? []).map((a) => a.student_id)));
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: ppl } = await supabase.rpc("get_public_names", { _ids: ids });
        for (const p of ppl ?? []) names[p.id] = p.full_name;
      }
      return (att ?? []).map((a) => ({ ...a, full_name: names[a.student_id] ?? "Unknown" }));
    },
  });

  const remove = useMutation({
    mutationFn: async (attendanceId: string) => {
      const { data, error } = await (supabase.rpc as any)("admin_remove_attendance", {
        _attendance_id: attendanceId,
      });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.error ?? "Failed");
    },
    onSuccess: () => {
      toast.success("Removed from activity");
      qc.invalidateQueries({ queryKey: ["attendance-log", activity.id] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold mb-1">{activity.name}</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Attendance log — remove a person to revoke their points for this activity.
      </p>
      {isLoading || !data ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          No one has scanned this activity yet.
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {data.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 glass rounded-xl px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{row.full_name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(row.scanned_at).toLocaleString()} · {row.points_awarded} pts
                </div>
              </div>
              <button
                disabled={remove.isPending}
                onClick={() => {
                  if (confirm(`Remove ${row.full_name} from "${activity.name}"? Their ${row.points_awarded} points will be subtracted.`))
                    remove.mutate(row.id);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 flex items-center gap-1 disabled:opacity-60"
              >
                <UserMinus className="h-3 w-3" /> Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ActivityForm({
  activity,
  onClose,
  onSaved,
}: {
  activity: Activity | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: activity?.name ?? "",
    description: activity?.description ?? "",
    event_date: activity?.event_date ?? new Date().toISOString().slice(0, 10),
    start_time: activity?.start_time ?? "",
    end_time: activity?.end_time ?? "",
    points: activity?.points ?? 10,
    max_scans_per_student: activity?.max_scans_per_student ?? 1,
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
      };
      const { error } = activity
        ? await supabase.from("activities").update(payload).eq("id", activity.id)
        : await supabase.from("activities").insert(payload);
      if (error) throw error;
      toast.success(activity ? "Updated" : "Created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold mb-4">
        {activity ? "Edit activity" : "New activity"}
      </h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input min-h-[80px]"
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Date">
            <input
              required
              type="date"
              value={form.event_date}
              onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Start">
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Points">
            <input
              type="number"
              min={0}
              value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Max scans / student">
            <input
              type="number"
              min={1}
              value={form.max_scans_per_student}
              onChange={(e) =>
                setForm({ ...form, max_scans_per_student: Number(e.target.value) })
              }
              className="input"
            />
          </Field>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            disabled={busy}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 font-medium glow disabled:opacity-60"
          >
            {activity ? "Save" : "Create"}
          </button>
          <button type="button" onClick={onClose} className="glass rounded-xl px-4">
            Cancel
          </button>
        </div>
      </form>
      <style>{`.input{width:100%;background:rgba(255,255,255,0.06);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.08);border-radius:0.75rem;padding:0.6rem 0.9rem;font-size:0.875rem;color:inherit;outline:none}.input:focus{box-shadow:0 0 0 2px oklch(0.78 0.19 150 / 0.4)}`}</style>
    </Modal>
  );
}

function QrModal({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_activity_qr", { _activity_id: activity.id });
      if (cancelled) return;
      if (error || !data) {
        setError(error?.message ?? "Failed to load QR");
        return;
      }
      setQr(data as string);
    })();
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const qrUrl = qr
    ? `https://nexus-points.lovable.app/scan?code=${encodeURIComponent(qr)}`
    : null;

  useEffect(() => {
    if (qrUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#0a1f17", light: "#a7f3d0" },
      });
    }
  }, [qrUrl]);

  function download() {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activity.name}-qr.png`;
    a.click();
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold mb-1">{activity.name}</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Print or display this QR for students to scan.
      </p>
      <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-center min-h-[200px]">
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : qr ? (
          <canvas ref={canvasRef} />
        ) : (
          <Loader />
        )}
      </div>
      {qrUrl && (
        <div className="mt-4 text-center">
          <code className="text-xs text-primary break-all">{qrUrl}</code>
        </div>
      )}
      <button
        onClick={download}
        disabled={!qr}
        className="w-full mt-4 bg-primary text-primary-foreground rounded-xl py-2.5 font-medium glow flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Download className="h-4 w-4" /> Download PNG
      </button>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-3xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
