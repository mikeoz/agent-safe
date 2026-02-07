import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/forms", label: "Forms" },
  { to: "/forms/register", label: "Register Form" },
  { to: "/instances", label: "My Instances" },
  { to: "/reviews", label: "Reviews" },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border px-6 py-3 flex items-center gap-6 overflow-x-auto">
        <Link to="/forms" className="font-mono text-sm text-primary font-semibold shrink-0">
          OPN4
        </Link>
        <div className="flex gap-4 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "whitespace-nowrap transition-colors",
                location.pathname === link.to
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[160px]">
            {user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </nav>
      <main className="container py-8 max-w-4xl">
        <Outlet />
      </main>
    </div>
  );
}
