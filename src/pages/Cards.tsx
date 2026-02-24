import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { KeyRound, Clock, ChevronDown } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────
function timeUntil(iso: string): { label: string; urgent: boolean; expired: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", urgent: false, expired: true };
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return { label: `Expires in ${hours}h ${mins}m`, urgent: hours < 2, expired: false };
  return { label: `Expires in ${mins}m`, urgent: true, expired: false };
}

function extractAgentName(payload: any): string {
  return (
    payload?.parties?.agents?.[0]?.display_name ||
    payload?.parties?.agent?.display_name ||
    payload?.card?.title ||
    "Unknown agent"
  );
}

function extractResources(payload: any): string[] {
  return (payload?.claims?.items || [])
    .map((c: any) => c?.resource?.display_name)
    .filter(Boolean);
}

// ── Section Heading ──────────────────────────────────────────────────────
function SectionDot({ color }: { color: string }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

// ── Permission Card (reusable across sections) ───────────────────────────
function PermissionRow({
  issuance,
  variant,
  onRevoke,
  onActivate,
}: {
  issuance: any;
  variant: "active" | "pending" | "closed";
  onRevoke?: (id: string, name: string) => void;
  onActivate?: (id: string, name: string) => void;
}) {
  const payload = issuance.card_instances?.payload as any;
  if (!payload) return null;

  const agentName = extractAgentName(payload);
  const resources = extractResources(payload);
  const expiresIso = payload?.lifecycle?.effective?.to;
  const expiry = variant === "active" && expiresIso ? timeUntil(expiresIso) : null;

  return (
    <div
      className={`rounded-lg border p-4 space-y-2 ${
        variant === "pending"
          ? "border-vault-amber/40 bg-vault-amber/5"
          : variant === "closed"
            ? "border-border/60 bg-muted/30"
            : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound
            className={`h-4 w-4 ${
              variant === "pending"
                ? "text-vault-amber"
                : variant === "closed"
                  ? "text-muted-foreground"
                  : "text-vault-green"
            }`}
          />
          <span className="font-semibold text-sm">{agentName}</span>
        </div>

        {variant === "active" && onRevoke && (
          <Button
            variant="destructive"
            size="sm"
            className="bg-vault-red hover:bg-vault-red/90 text-vault-red-foreground"
            onClick={() => onRevoke(issuance.id, agentName)}
          >
            Close the door
          </Button>
        )}
        {variant === "pending" && onActivate && (
          <Button
            size="sm"
            className="bg-vault-green hover:bg-vault-green/90 text-vault-green-foreground"
            onClick={() => onActivate(issuance.id, agentName)}
          >
            Activate permission
          </Button>
        )}
      </div>

      {resources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Can see:</span> {resources.join(", ")}
        </p>
      )}

      {variant === "pending" && (
        <p className="text-xs font-medium text-vault-amber">⏳ Waiting for your approval</p>
      )}

      {variant === "closed" && issuance.resolved_at && (
        <p className="text-xs text-muted-foreground">
          Closed at{" "}
          {new Date(issuance.resolved_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      )}

      {expiry && (
        <p
          className={`text-xs font-medium ${
            expiry.expired
              ? "text-vault-red"
              : expiry.urgent
                ? "text-vault-amber"
                : "text-muted-foreground"
          }`}
        >
          <Clock className="inline h-3 w-3 mr-1" />
          {expiry.label}
        </p>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function Cards() {
  usePageTitle(useLocation().pathname);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [active, setActive] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [closed, setClosed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closedOpen, setClosedOpen] = useState(false);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch all issuances joined to use-card instances
    const { data: accepted } = await supabase
      .from("card_issuances")
      .select("id, status, issued_at, resolved_at, card_instances(id, payload)")
      .eq("status", "accepted")
      .order("issued_at", { ascending: false });

    const { data: issued } = await supabase
      .from("card_issuances")
      .select("id, status, issued_at, resolved_at, card_instances(id, payload)")
      .eq("status", "issued")
      .order("issued_at", { ascending: false });

    const { data: revoked } = await supabase
      .from("card_issuances")
      .select("id, status, issued_at, resolved_at, card_instances(id, payload)")
      .eq("status", "revoked")
      .order("issued_at", { ascending: false });

    setActive(accepted || []);
    setPending(issued || []);
    setClosed(revoked || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Revoke ───────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const { error } = await supabase.rpc("revoke_card_issuance", {
        p_issuance_id: revokeTarget.id,
      });
      if (error) throw error;
      toast({
        title: `Door closed. ${revokeTarget.name} no longer has access.`,
        description: "The activity log has been updated.",
      });
      setRevokeTarget(null);
      fetchAll();
    } catch (err: any) {
      toast({
        title: "Something went wrong",
        description: err?.message || "Could not close the door. Try again.",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  // ── Activate ─────────────────────────────────────────────────────────
  const handleActivate = async (id: string, name: string) => {
    try {
      const { error } = await supabase.rpc("resolve_card_issuance", {
        p_issuance_id: id,
        p_resolution: "accepted",
      });
      if (error) throw error;
      toast({
        title: `Permission activated. ${name} now has access.`,
        description: "You can close the door at any time.",
      });
      fetchAll();
    } catch (err: any) {
      toast({
        title: "Could not activate permission",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isEmpty = active.length === 0 && pending.length === 0 && closed.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold mb-1">CARDs</h1>
          <p className="text-sm text-muted-foreground">
            Community Approved Reliable Data — your permission slips.
          </p>
        </div>
        <Button
          className="bg-vault-green hover:bg-vault-green/90 text-vault-green-foreground shrink-0"
          onClick={() => navigate("/cards/use/new")}
        >
          + Write a new permission slip
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isEmpty ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            No permission slips yet. Write one to give an agent access to your data.
          </p>
          <Button
            className="bg-vault-green hover:bg-vault-green/90 text-vault-green-foreground"
            onClick={() => navigate("/cards/use/new")}
          >
            + Write a new permission slip
          </Button>
        </div>
      ) : (
        <>
          {/* Section 1 — Active */}
          {active.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <SectionDot color="bg-vault-green" />
                <h2 className="text-base font-bold">Active</h2>
                <Badge variant="secondary" className="text-xs">{active.length}</Badge>
              </div>
              <div className="space-y-3">
                {active.map((iss) => (
                  <PermissionRow
                    key={iss.id}
                    issuance={iss}
                    variant="active"
                    onRevoke={(id, name) => setRevokeTarget({ id, name })}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section 2 — Pending */}
          {pending.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <SectionDot color="bg-vault-amber" />
                <h2 className="text-base font-bold">Waiting for your approval</h2>
                <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
              </div>
              <div className="space-y-3">
                {pending.map((iss) => (
                  <PermissionRow
                    key={iss.id}
                    issuance={iss}
                    variant="pending"
                    onActivate={handleActivate}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section 3 — Closed */}
          {closed.length > 0 && (
            <Collapsible open={closedOpen} onOpenChange={setClosedOpen}>
              <section className="space-y-3">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 w-full text-left">
                    <SectionDot color="bg-muted-foreground/50" />
                    <h2 className="text-base font-bold text-muted-foreground">Closed</h2>
                    <Badge variant="secondary" className="text-xs">{closed.length}</Badge>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${closedOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 pt-1">
                    {closed.map((iss) => (
                      <PermissionRow key={iss.id} issuance={iss} variant="closed" />
                    ))}
                  </div>
                </CollapsibleContent>
              </section>
            </Collapsible>
          )}
        </>
      )}

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to close the door?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately and permanently remove{" "}
              <strong>{revokeTarget?.name}</strong>'s permission to access your data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-vault-red hover:bg-vault-red/90 text-vault-red-foreground"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking ? "Closing…" : "Yes, close the door"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
