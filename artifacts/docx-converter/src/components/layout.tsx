import { useState, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText, History, BarChart3, LayoutDashboard, X, Menu } from "lucide-react";
import { useHealthCheck } from "@workspace/api-client-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: health } = useHealthCheck();

  const navItems = [
    { href: "/", label: "Converter", icon: LayoutDashboard },
    { href: "/history", label: "History", icon: History },
    { href: "/stats", label: "Statistics", icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0">
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
              />
              System Status
            </span>
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Bar ───────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-5 w-5" />
          <span className="font-bold text-base tracking-tight">DocStudio</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-md text-foreground hover:bg-muted transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* ── Mobile Slide-out Menu ─────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
          <div className="relative ml-auto w-72 h-full bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="h-14 flex items-center justify-between px-5 border-b border-border">
              <div className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <span className="font-bold text-base">DocStudio</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 flex-1">
              <div className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider px-2">
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
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 rounded-md transition-colors text-base ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-muted"
                      }`}
                      data-testid={`nav-link-${item.label.toLowerCase()}`}
                    >
                      <Icon className="h-5 w-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="p-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    health?.status === "ok" ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                System Status
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-background relative pt-14 md:pt-0 pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Tab Bar ─────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-card border-t border-border flex items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-colors min-w-0 flex-1 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-link-${item.label.toLowerCase()}`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="text-[10px] font-medium leading-none truncate">{item.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
