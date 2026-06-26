import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Check, Clock, Calendar } from "lucide-react";

type Activity = {
  id: string;
  name: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  points: number;
  is_active: boolean;
};

function todayKey() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ActivitiesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = useMemo(todayKey, []);

  const { data: activities, isLoading } = useQuery({
    queryKey: ["all-activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id,name,description,event_date,start_time,end_time,points,is_active")
        .eq("is_active", true)
        .order("event_date", { ascending: true });
      if (error) throw error;
      return data as Activity[];
    },
  });

  const { data: myRegs } = useQuery({
    queryKey: ["my-registrations", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_registrations")
        .select("activity_id")
        .eq("student_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.activity_id));
    },
  });

  const register = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("activity_registrations")
        .insert({ activity_id: activityId, student_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registered!");
      qc.invalidateQueries({ queryKey: ["my-registrations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const cancel = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from("activity_registrations")
        .delete()
        .eq("activity_id", activityId)
        .eq("student_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration canceled");
      qc.invalidateQueries({ queryKey: ["my-registrations"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const { upcoming, past } = useMemo(() => {
    const up: Activity[] = [];
    const pa: Activity[] = [];
    for (const a of activities ?? []) {
      const d = new Date(a.event_date + "T00:00:00");
      if (d < today) pa.push(a);
      else up.push(a);
    }
    pa.reverse();
    return { upcoming: up, past: pa };
  }, [activities, today]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading activities…</div>;
  }

  const renderCard = (a: Activity, isPast: boolean) => {
    const registered = myRegs?.has(a.id) ?? false;
    return (
      <div key={a.id} className="glass rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm md:text-base truncate">{a.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {fmtDate(a.event_date)}
              </span>
              {(a.start_time || a.end_time) && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {a.start_time?.slice(0, 5) ?? "--"}
                  {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
            {a.points} pts
          </span>
        </div>
        {a.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.description}</p>
        )}
        <div className="mt-3">
          {isPast ? (
            <button
              disabled
              className="w-full rounded-xl py-2 text-xs glass opacity-60 cursor-not-allowed"
            >
              Closed
            </button>
          ) : registered ? (
            <button
              onClick={() => cancel.mutate(a.id)}
              disabled={cancel.isPending}
              className="w-full rounded-xl py-2 text-xs glass hover:bg-white/10 flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3 text-primary" /> Registered — cancel
            </button>
          ) : (
            <button
              onClick={() => register.mutate(a.id)}
              disabled={register.isPending}
              className="w-full rounded-xl py-2 text-xs bg-primary text-primary-foreground font-medium glow disabled:opacity-60"
            >
              Register
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
          Upcoming ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
            No upcoming activities.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {upcoming.map((a) => renderCard(a, false))}
          </div>
        )}
      </div>
      {past.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Past ({past.length})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-70">
            {past.slice(0, 10).map((a) => renderCard(a, true))}
          </div>
        </div>
      )}
    </div>
  );
}
