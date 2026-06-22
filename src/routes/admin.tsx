import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireRole role="admin">
      {() => (
        <AppShell role="admin">
          <Outlet />
        </AppShell>
      )}
    </RequireRole>
  ),
});
