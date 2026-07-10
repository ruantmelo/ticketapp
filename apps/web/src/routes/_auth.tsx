import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { AuthSession } from "@ticket-chain/shared";
import { sessionQuery } from "@/lib/queries";
import { defaultRouteFor, safeRedirect } from "@/lib/rbac";

function AuthLayout() {
  return <Outlet />;
}

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context, location }) => {
    let session: AuthSession | null = null;
    try {
      session = await context.queryClient.ensureQueryData(sessionQuery);
    } catch {
      session = null;
    }

    if (session) {
      throw redirect({
        to: safeRedirect(new URL(location.href).searchParams.get("redirect"), defaultRouteFor(session.user)),
      });
    }
  },
  component: AuthLayout,
});
