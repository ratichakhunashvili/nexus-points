import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/seed-demo")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        async function upsertUser(email: string, password: string, fullName: string, isAdmin: boolean) {
          // try to find existing
          const { data: list } = await supabaseAdmin.auth.admin.listUsers();
          let existing = list?.users.find((u) => u.email === email);
          if (!existing) {
            const { data, error } = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });
            if (error) throw error;
            existing = data.user!;
          }
          if (isAdmin) {
            await supabaseAdmin
              .from("user_roles")
              .upsert({ user_id: existing.id, role: "admin" }, { onConflict: "user_id,role" });
          }
          return existing.id;
        }

        try {
          const adminId = await upsertUser("admin@demo.test", "demo1234", "Demo Admin", true);
          const studentId = await upsertUser("student@demo.test", "demo1234", "Alex Student", false);

          // seed a sample activity if none
          const { count } = await supabaseAdmin
            .from("activities")
            .select("*", { count: "exact", head: true });
          if (!count) {
            await supabaseAdmin.from("activities").insert([
              {
                name: "Welcome Orientation",
                description: "Kickoff event for new students.",
                event_date: new Date().toISOString().slice(0, 10),
                points: 50,
                max_scans_per_student: 1,
                created_by: adminId,
              },
              {
                name: "Campus Cleanup Day",
                description: "Volunteer to keep our campus green.",
                event_date: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
                points: 100,
                max_scans_per_student: 1,
                created_by: adminId,
              },
            ]);
          }

          return Response.json({ ok: true, adminId, studentId });
        } catch (err) {
          const message = err instanceof Error ? err.message : "seed failed";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
