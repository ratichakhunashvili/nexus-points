import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/loader";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, CalendarDays, Clock } from "lucide-react";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarPage,
});

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

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(toDateKey(today));

  const { data: activities, isLoading } = useQuery({
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

  // Group activities by date key
  const byDate = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities ?? []) {
      const arr = map.get(a.event_date) ?? [];
      arr.push(a);
      map.set(a.event_date, arr);
    }
    return map;
  }, [activities]);

  // Build month grid (Mon-Sun)
  const monthGrid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startWeekday = (first.getDay() + 6) % 7; // Mon=0
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" /> Activity Calendar
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse upcoming activities and reserve your spot.
        </p>
      </div>

      <div className="glass rounded-2xl p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-semibold capitalize">{monthLabel}</div>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <Loader />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center mb-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
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
                    className={`aspect-square rounded-xl p-1 md:p-2 text-xs flex flex-col items-start justify-start transition-all
                      ${inMonth ? "text-foreground" : "text-muted-foreground/40"}
                      ${isSelected ? "bg-primary text-primary-foreground glow" : "hover:bg-white/10"}
                      ${isToday && !isSelected ? "ring-1 ring-primary" : ""}
                      ${past && !isSelected ? "opacity-60" : ""}
                    `}
                  >
                    <span className="text-[10px] md:text-xs font-medium">{d.getDate()}</span>
                    {items.length > 0 && (
                      <span
                        className={`mt-auto text-[9px] md:text-[10px] rounded-full px-1.5 py-0.5 ${
                          isSelected ? "bg-white/25" : "bg-primary/20 text-primary"
                        }`}
                      >
                        {items.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">
            {selectedDate.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h2>
          {isPast && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Registration closed
            </span>
          )}
        </div>

        {selectedActivities.length === 0 ? (
          <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
            No activities on this day.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {selectedActivities.map((a) => {
              const registered = myRegs?.has(a.id) ?? false;
              return (
                <div key={a.id} className="glass rounded-2xl p-4 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{a.name}</div>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                      {a.points} pts
                    </span>
                  </div>
                  {a.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                  )}
                  {(a.start_time || a.end_time) && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {a.start_time?.slice(0, 5) ?? "--"}
                      {a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}
                    </div>
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
