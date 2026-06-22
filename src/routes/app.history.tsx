import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader } from "@/components/loader";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, points_awarded, scanned_at, activities(name, description, event_date)")
        .eq("student_id", user!.id)
        .order("scanned_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity History</h1>
      {isLoading || !data ? (
        <Loader />
      ) : data.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          You haven't attended any activities yet.
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden divide-y divide-white/5">
          {data.map((row) => (
            <div key={row.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{row.activities?.name ?? "Activity"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {row.activities?.description ?? ""}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(row.scanned_at).toLocaleString()}
                </div>
              </div>
              <div className="text-primary font-semibold whitespace-nowrap">
                +{row.points_awarded} pts
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
