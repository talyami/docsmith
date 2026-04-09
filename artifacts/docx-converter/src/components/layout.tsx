import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText, History, BarChart3, LayoutDashboard, Settings } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "Converter", icon: LayoutDashboard },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Statistics", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0 transition-all duration-300">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-6 w-6" />
            <span className="font-bold text-lg tracking-tight">DocStudio</span>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider px-2">
            Workspace
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-foreground hover:bg-muted"
                  }`}
                  data-testid={`nav-link-${item.label.toLowerCase()}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  health?.status === "ok" ? "bg-green-500" : "bg-yellow-500"
                }`}
              ></span>
              System Status
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background relative">
        {children}
      </main>
    </div>
  );
}
