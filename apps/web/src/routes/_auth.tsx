import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sessionQuery } from "@/lib/queries";
import { safeRedirect } from "@/lib/rbac";

function AuthLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    let isAuthenticated = false;
    try {
      await context.queryClient.ensureQueryData(sessionQuery);
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }

    if (isAuthenticated) {
      throw redirect({ to: safeRedirect(new URL(location.href).searchParams.get("redirect"), "/events") });
    }
  },
  component: AuthLayout,
});
