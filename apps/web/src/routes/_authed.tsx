import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Sidebar } from "@/components/organizer/sidebar";
import { sessionQuery } from "@/lib/queries";
import { safeRedirect } from "@/lib/rbac";

function AuthedLayout() {
  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(sessionQuery);
    } catch {
      throw redirect({ to: "/login", search: { redirect: safeRedirect(location.href, "/events") } });
    }
  },
  component: AuthedLayout,
});
