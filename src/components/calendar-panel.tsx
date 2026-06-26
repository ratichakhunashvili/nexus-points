import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, Clock } from "lucide-react";

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

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CalendarPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(toDateKey(today));

  const { data: activities } = useQuery({
    queryKey: ["calendar-activities"],
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
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to register"),
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

  const byDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities ?? []) {
      const arr = map.get(a.event_date) ?? [];
      arr.push(a);
      map.set(a.event_date, arr);
    }
    return map;
  }, [activities]);

  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - startWeekday);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedActivities = byDate.get(selected) ?? [];
  const selectedDate = new Date(selected + "T00:00:00");
  const isPast = selectedDate < today;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="glass rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold capitalize">{monthLabel}</div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-[9px] uppercase tracking-wide text-muted-foreground text-center mb-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {monthGrid.map((d) => {
            const key = toDateKey(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isToday = key === toDateKey(today);
            const isSelected = key === selected;
            const items = byDate.get(key) ?? [];
            const past = d < today;
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={`relative aspect-square rounded-md text-[11px] flex items-center justify-center transition-all
                  ${inMonth ? "text-foreground" : "text-muted-foreground/40"}
                  ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-white/10"}
                  ${isToday && !isSelected ? "ring-1 ring-primary" : ""}
                  ${past && !isSelected ? "opacity-50" : ""}
                `}
              >
                <span className="font-medium">{d.getDate()}</span>
                {items.length > 0 && (
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold text-sm">
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          {isPast && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Closed
            </span>
          )}
        </div>
        {selectedActivities.length === 0 ? (
          <div className="glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
            No activities on this day.
          </div>
        ) : (
          <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
            {selectedActivities.map((a) => {
              const registered = myRegs?.has(a.id) ?? false;
              return (
                <div key={a.id} className="glass rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-sm">{a.name}</div>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                      {a.points} pts
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                  )}
                  {(a.start_time || a.end_time) && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {a.start_time?.slice(0, 5) ?? "--"}
                      {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                    </div>
                  )}
                  <div className="mt-2">
                    {isPast ? (
                      <button
                        disabled
                        className="w-full rounded-xl py-1.5 text-xs glass opacity-60 cursor-not-allowed"
                      >
                        Closed
                      </button>
                    ) : registered ? (
                      <button
                        onClick={() => cancel.mutate(a.id)}
                        disabled={cancel.isPending}
                        className="w-full rounded-xl py-1.5 text-xs glass hover:bg-white/10 flex items-center justify-center gap-1"
                      >
                        <Check className="h-3 w-3 text-primary" /> Registered — cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => register.mutate(a.id)}
                        disabled={register.isPending}
                        className="w-full rounded-xl py-1.5 text-xs bg-primary text-primary-foreground font-medium glow disabled:opacity-60"
                      >
                        Register
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
