import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, FileSpreadsheet } from "lucide-react";
import type { ReactNode as RN } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/billing", label: "Billing", icon: FileText },
  { to: "/quotation", label: "Quotation", icon: FileSpreadsheet },
] as const;

export function AppLayout({ children, title }: { children: RN; title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-56 shrink-0 border-r bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-5 py-5 border-b">
          <div className="font-bold text-sm leading-tight">TDA Car Rental</div>
          <div className="text-[11px] text-muted-foreground">Billing & Quotation</div>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b bg-card px-6 py-4">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        </header>
        <main className="flex-1 px-6 py-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
