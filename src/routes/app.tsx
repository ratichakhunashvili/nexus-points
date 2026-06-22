import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { RequireRole } from "@/components/require-role";

export const Route = createFileRoute("/app")({
  component: () => (
    <RequireRole role="student">
      {() => (
        <AppShell role="student">
          <Outlet />
        </AppShell>
      )}
    </RequireRole>
  ),
});
