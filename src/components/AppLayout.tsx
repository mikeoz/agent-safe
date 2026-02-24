import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import opnLogo from "@/assets/Opnli_head_logo_CLEAN.png";

const navLinks = [
  { to: "/", label: "My Front Door" },
  { to: "/cards/use/new", label: "Write a Permission Slip" },
  { to: "/audit", label: "Activity Log" },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  const copyUserId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      toast({ title: "Copied", description: "User ID copied to clipboard." });
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border px-6 py-3 flex items-center gap-6 overflow-x-auto">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={opnLogo} alt="Openly logo" className="h-7 w-auto" />
          <span className="font-mono text-sm text-primary font-semibold">Openly Vault</span>
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
          <button
            onClick={copyUserId}
            className="text-xs text-muted-foreground font-mono truncate max-w-[160px] hover:text-foreground transition-colors cursor-pointer"
            title={`Click to copy: ${user?.id}`}
          >
            {user?.id ? user.id.slice(0, 8) + "…" : user?.email}
          </button>
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
