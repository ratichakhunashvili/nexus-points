import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Loader } from "./loader";

export function RequireRole({
  role,
  children,
}: {
  role: AppRole;
  children: (ctx: { userId: string }) => ReactNode;
}) {
  const { user, role: userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (userRole && userRole !== role) {
      navigate({ to: userRole === "admin" ? "/admin" : "/app" });
    }
  }, [user, userRole, loading, role, navigate]);

  if (loading || !user || !userRole) return <Loader />;
  if (userRole !== role) return <Loader label="Redirecting…" />;
  return <>{children({ userId: user.id })}</>;
}
