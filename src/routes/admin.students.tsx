import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { toast } from "sonner";
import { Gift, Minus, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/admin/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const [modalFor, setModalFor] = useState<{ id: string; name: string; mode: "add" | "remove" } | null>(null);
  const [deleteFor, setDeleteFor] = useState<{ id: string; name: string } | null>(null);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("admin_delete_user", { _user_id: id });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed");
    },
    onSuccess: () => {
      toast.success(`Removed ${deleteFor?.name}`);
      setDeleteFor(null);
      qc.invalidateQueries({ queryKey: ["all-students"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      const adminIds = (admins ?? []).map((r) => r.user_id);
      let q = supabase
        .from("profiles")
        .select("id, full_name, email, total_points, created_at")
        .order("total_points", { ascending: false });
      if (adminIds.length) q = q.not("id", "in", `(${adminIds.join(",")})`);
      const { data } = await q;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Students</h1>
        <p className="text-sm text-muted-foreground">Award bonus points or review profiles.</p>
      </div>
      {isLoading || !data ? (
        <Loader />
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3 hidden md:table-cell">Email</th>
                <th className="text-right p-3">Points</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((s) => (
                <tr key={s.id}>
                  <td className="p-3 font-medium">{s.full_name}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{s.email}</td>
                  <td className="p-3 text-right font-semibold">{s.total_points}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => setModalFor({ id: s.id, name: s.full_name, mode: "add" })}
                        className="glass rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 hover:bg-white/10"
                      >
                        <Gift className="h-3 w-3" /> Bonus
                      </button>
                      <button
                        onClick={() => setModalFor({ id: s.id, name: s.full_name, mode: "remove" })}
                        className="glass rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 text-destructive hover:bg-destructive/10"
                      >
                        <Minus className="h-3 w-3" /> Remove
                      </button>
                      <button
                        onClick={() => setDeleteFor({ id: s.id, name: s.full_name })}
                        className="glass rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 text-destructive hover:bg-destructive/10"
                        title="Delete user account"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalFor && (
        <BonusModal
          student={{ id: modalFor.id, name: modalFor.name }}
          initialMode={modalFor.mode}
          onClose={() => setModalFor(null)}
          onDone={() => {
            setModalFor(null);
            qc.invalidateQueries({ queryKey: ["all-students"] });
          }}
        />
      )}

      {deleteFor && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !deleteMut.isPending && setDeleteFor(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="glass rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold">Delete user?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This permanently removes <strong>{deleteFor.name}</strong>, their points, attendance, and achievements. They will need to register again to return.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeleteFor(null)}
                disabled={deleteMut.isPending}
                className="flex-1 glass rounded-xl py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteFor.id)}
                disabled={deleteMut.isPending}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-destructive text-destructive-foreground disabled:opacity-60"
              >
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BonusModal({
  student,
  initialMode = "add",
  onClose,
  onDone,
}: {
  student: { id: string; name: string };
  initialMode?: "add" | "remove";
  onClose: () => void;
  onDone: () => void;
}) {
  const [points, setPoints] = useState(10);
  const [direction, setDirection] = useState<"add" | "remove">(initialMode);
  const [reason, setReason] = useState("");
  const signed = direction === "add" ? Math.abs(points) : -Math.abs(points);

  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("award_bonus_points", {
        _student: student.id,
        _points: signed,
        _reason: reason || (direction === "add" ? "Bonus" : "Adjustment"),
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed");
    },
    onSuccess: () => {
      const verb = direction === "add" ? "Awarded" : "Removed";
      const sign = direction === "add" ? "+" : "−";
      toast.success(`${verb} ${sign}${Math.abs(points)} pts ${direction === "add" ? "to" : "from"} ${student.name}`);
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-3xl p-6 w-full max-w-sm relative"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">Adjust points</h2>
        <p className="text-sm text-muted-foreground mb-4">for {student.name}</p>

        <div className="flex gap-1 p-1 glass rounded-xl mb-4">
          {(["add", "remove"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`flex-1 py-1.5 text-xs rounded-lg transition ${
                direction === d
                  ? d === "add"
                    ? "bg-primary text-primary-foreground"
                    : "bg-destructive text-destructive-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {d === "add" ? "Add points" : "Remove points"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs text-muted-foreground">Points</span>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Math.max(1, Number(e.target.value) || 0))}
            className="w-full mt-1 glass rounded-xl px-3 py-2 text-sm bg-transparent"
          />
        </label>
        <label className="block mt-3">
          <span className="text-xs text-muted-foreground">Reason (optional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full mt-1 glass rounded-xl px-3 py-2 text-sm bg-transparent"
          />
        </label>
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className={`w-full mt-5 rounded-xl py-2.5 font-medium glow disabled:opacity-60 ${
            direction === "add"
              ? "bg-primary text-primary-foreground"
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {direction === "add" ? `Add +${points}` : `Remove −${points}`}
        </button>
      </div>
    </div>
  );
}

