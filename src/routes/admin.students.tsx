import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { toast } from "sonner";
import { Gift, X } from "lucide-react";

export const Route = createFileRoute("/admin/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const qc = useQueryClient();
  const [bonusFor, setBonusFor] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, total_points, created_at")
        .order("total_points", { ascending: false });
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
                    <button
                      onClick={() => setBonusFor({ id: s.id, name: s.full_name })}
                      className="glass rounded-lg px-2.5 py-1 text-xs flex items-center gap-1 ml-auto hover:bg-white/10"
                    >
                      <Gift className="h-3 w-3" /> Bonus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bonusFor && (
        <BonusModal
          student={bonusFor}
          onClose={() => setBonusFor(null)}
          onDone={() => {
            setBonusFor(null);
            qc.invalidateQueries({ queryKey: ["all-students"] });
          }}
        />
      )}
    </div>
  );
}

function BonusModal({
  student,
  onClose,
  onDone,
}: {
  student: { id: string; name: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("award_bonus_points", {
        _student: student.id,
        _points: points,
        _reason: reason || "Bonus",
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error ?? "Failed");
    },
    onSuccess: () => {
      toast.success(`Awarded +${points} pts to ${student.name}`);
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
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold">Award bonus points</h2>
        <p className="text-sm text-muted-foreground mb-4">to {student.name}</p>
        <label className="block">
          <span className="text-xs text-muted-foreground">Points</span>
          <input
            type="number"
            min={1}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            className="w-full mt-1 glass rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <label className="block mt-3">
          <span className="text-xs text-muted-foreground">Reason (optional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full mt-1 glass rounded-xl px-3 py-2 text-sm"
          />
        </label>
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className="w-full mt-5 bg-primary text-primary-foreground rounded-xl py-2.5 font-medium glow disabled:opacity-60"
        >
          Award
        </button>
      </div>
    </div>
  );
}
