import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Calendar, FileText, PlusCircle, Settings, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem =
  | {
      label: string;
      to: "/events/new";
      search: { step: "detalhes" };
      icon: React.ComponentType<{ className?: string }>;
    }
  | {
      label: string;
      to: "/events";
      search?: { status: "draft" };
      icon: React.ComponentType<{ className?: string }>;
    }
  | {
      label: string;
      to: "/settings";
      icon: React.ComponentType<{ className?: string }>;
    };

interface BaseNavItem {
  label: string;
  to: string;
  search?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
}

const ORG_ITEMS: NavItem[] = [
  { label: "Criar evento", to: "/events/new", search: { step: "detalhes" }, icon: PlusCircle },
  { label: "Meus Eventos", to: "/events", icon: Calendar },
  { label: "Rascunhos", to: "/events", search: { status: "draft" }, icon: FileText },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Configurações", to: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center bg-primary">
          <Ticket className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-card-foreground">Ticket App</span>
          <span className="text-xs text-sidebar-foreground">Painel do organizador</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
        <SidebarSection title="ORGANIZADOR">
          {ORG_ITEMS.map((item) => (
            <SidebarLink key={navKey(item)} item={item} />
          ))}
        </SidebarSection>

        <SidebarSection title="CONTA">
          {ACCOUNT_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </SidebarSection>
      </nav>
    </aside>
  );
}

function navKey(item: BaseNavItem) {
  return `${item.to}:${item.search?.status ?? item.search?.step ?? ""}`;
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-3 py-2 text-xs font-medium tracking-wide text-sidebar-foreground">{title}</p>
      {children}
    </div>
  );
}

function SidebarLink({ item }: { item: BaseNavItem }) {
  const Icon = item.icon;
  const location = useLocation();
  const isDrafts = item.to === "/events" && item.search?.status === "draft";
  const isActive = isDrafts
    ? location.pathname === "/events" && location.search.status === "draft"
    : location.pathname === item.to && (item.to !== "/events" || location.search.status !== "draft");

  return (
    <Link
      to={item.to}
      search={item.search}
      className={cn(
        "flex items-center gap-3 px-3 py-3 text-sm font-medium",
        isActive
          ? "border-l-2 border-sidebar-primary bg-sidebar-accent text-sidebar-accent-foreground"
          : "border-l-2 border-transparent text-sidebar-foreground hover:bg-sidebar-accent/50",
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
