import { createFileRoute, redirect } from "@tanstack/react-router";
import { sessionQuery } from "@/lib/queries";
import { defaultRouteFor, safeRedirect } from "@/lib/rbac";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context, location }) => {
    let session;
    try {
      session = await context.queryClient.ensureQueryData(sessionQuery);
    } catch {
      throw redirect({ to: "/login", search: { redirect: safeRedirect(location.href, "/events") } });
    }
    throw redirect({ to: defaultRouteFor(session.user) });
  },
});
