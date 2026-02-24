import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import opnLogo from "@/assets/Opnli_head_logo_CLEAN.png";

const navTabs = [
  { to: "/entities", label: "Entities & Agents" },
  { to: "/data", label: "Data Rooms" },
  { to: "/cards", label: "CARDs" },
  { to: "/activity", label: "Activities & Reports" },
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
      {/* ── Top nav ── */}
      <nav className="border-b border-border px-6 py-3 flex items-center gap-6 overflow-x-auto">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={opnLogo} alt="Opn.li" className="h-8 w-auto cursor-pointer" />
          <span className="text-xs text-muted-foreground hover:text-foreground transition-colors">home</span>
        </Link>

        <div className="flex gap-5 text-sm">
          {navTabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "whitespace-nowrap transition-colors py-1",
                location.pathname === tab.to || location.pathname.startsWith(tab.to + "/")
                  ? "text-foreground font-bold underline underline-offset-4"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
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

      {/* ── Navy banner ── */}
      <div className="bg-vault-navy text-vault-navy-foreground px-6 py-3 flex items-center justify-between">
        <div />
        <span className="italic text-blue-200 text-sm">My data. Your AI. My control.</span>
        <span className="text-sm opacity-80">{user?.email}</span>
      </div>

      <main className="container py-8 max-w-4xl">
        <Outlet />
      </main>
    </div>
  );
}
