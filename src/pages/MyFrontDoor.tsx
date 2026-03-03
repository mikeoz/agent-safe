import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Shield, Lock, ShieldCheck, KeyRound, Clock, ExternalLink } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────
const VERIFY_URL =
  "https://biejnguqnejzwmypotez.supabase.co/functions/v1/verify-card";
const DATA_FORM_ID = "147a8e87-46f6-4145-b27e-87abbf8cdb77";
const STATS_INTERVAL = 30_000;
const FEED_INTERVAL = 15_000;

// ── Helpers ──────────────────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  if (isToday) return time;
  return `${d.toLocaleDateString("en-GB", { month: "short", day: "numeric" })} — ${time}`;
}

function timeUntil(iso: string): { label: string; urgent: boolean; expired: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", urgent: false, expired: true };
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return { label: `Expires in ${hours}h ${mins}m`, urgent: hours < 2, expired: false };
  return { label: `Expires in ${mins}m`, urgent: true, expired: false };
}

const FEED_META: Record<string, { icon: string; color: string; label: string }> = {
  verification_queried: { icon: "🚪", color: "text-vault-navy", label: "Front door checked" },
  card_issued: { icon: "📋", color: "text-vault-green", label: "Permission sent" },
  card_accepted: { icon: "✅", color: "text-vault-green", label: "Permission activated" },
  card_revoked: { icon: "🔒", color: "text-vault-red", label: "Door closed" },
  agent_query_authorized: { icon: "✅", color: "text-vault-green", label: "Question answered" },
  agent_query_denied: { icon: "❌", color: "text-vault-red", label: "Question blocked" },
};

// ── Stat Card ────────────────────────────────────────────────────────────
function StatCard({
  icon,
  value,
  label,
  subLabel,
  variant = "default",
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  subLabel: string;
  variant?: "green" | "amber" | "default";
}) {
  const bg =
    variant === "green"
      ? "bg-vault-green/10 border-vault-green/30"
      : variant === "amber"
        ? "bg-vault-amber/10 border-vault-amber/30"
        : "bg-card border-border";
  return (
    <div className={`rounded-lg border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span></div>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{subLabel}</p>
    </div>
  );
}

// ── Permission Card ──────────────────────────────────────────────────────
function PermissionCard({
  issuance,
  onRevoke,
  onActivate,
}: {
  issuance: any;
  onRevoke: (id: string, name: string) => void;
  onActivate: (id: string, name: string) => void;
}) {
  const payload = issuance.card_instances?.payload as any;
  if (!payload) return null;

  const isPending = issuance.status === "issued";

  const agentName =
    payload?.parties?.agents?.[0]?.display_name ||
    payload?.parties?.agent?.display_name ||
    payload?.card?.title ||
    "Unknown agent";

  const resources: string[] =
    (payload?.claims?.items || [])
      .map((c: any) => c?.resource?.display_name)
      .filter(Boolean);

  const expiresIso = payload?.lifecycle?.effective?.to;
  const expiry = !isPending && expiresIso ? timeUntil(expiresIso) : null;

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${isPending ? "border-vault-amber/40 bg-vault-amber/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className={`h-4 w-4 ${isPending ? "text-vault-amber" : "text-vault-green"}`} />
          <span className="font-semibold text-sm">{agentName}</span>
        </div>
        {isPending ? (
          <Button
            size="sm"
            className="bg-vault-green hover:bg-vault-green/90 text-vault-green-foreground"
            onClick={() => onActivate(issuance.id, agentName)}
          >
            Activate permission
          </Button>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            className="bg-vault-red hover:bg-vault-red/90 text-vault-red-foreground"
            onClick={() => onRevoke(issuance.id, agentName)}
          >
            Close the door
          </Button>
        )}
      </div>
      {resources.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Can see:</span> {resources.join(", ")}
        </p>
      )}
      {isPending && (
        <p className="text-xs font-medium text-vault-amber">
          ⏳ Waiting for your approval
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
export default function MyFrontDoor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Stats
  const [endpointOk, setEndpointOk] = useState<boolean | null>(null);
  const [dataCount, setDataCount] = useState<number>(0);
  const [checksToday, setChecksToday] = useState<number>(0);
  const [activePerms, setActivePerms] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Permissions
  const [issuances, setIssuances] = useState<any[]>([]);

  // Activity feed
  const [feed, setFeed] = useState<any[]>([]);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  // ── Fetch stats ──────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    // 1. Endpoint health — use demo-verify proxy to avoid CORS restrictions
    if (!user) {
      setEndpointOk(null);
    } else {
      try {
        const { data, error } = await supabase.functions.invoke("demo-verify", {
          body: { agent_id: "urn:uuid:00000000-0000-0000-0000-000000000000" },
        });
        // Any response (even an error payload) means the endpoint is reachable
        setEndpointOk(true);
      } catch {
        setEndpointOk(false);
      }
    }

    // 2. Data count
    try {
      const { count } = await supabase
        .from("card_instances")
        .select("id", { count: "exact", head: true })
        .eq("form_id", DATA_FORM_ID);
      setDataCount(count ?? 0);
    } catch {
      /* ignore */
    }

    // 3. Door checks today — use get_my_recent_audit (RLS-safe)
    try {
      const { data } = await supabase.rpc("get_my_recent_audit", { p_limit: 100 });
      const today = new Date().toISOString().split("T")[0];
      const todayChecks = (data || []).filter(
        (e: any) =>
          e.action === "verification_queried" &&
          e.created_at?.startsWith(today)
      );
      setChecksToday(todayChecks.length);
    } catch {
      /* ignore */
    }

    // 4. Active permissions
    try {
      const { count } = await supabase
        .from("card_issuances")
        .select("id", { count: "exact", head: true })
        .in("status", ["issued", "accepted"]);
      setActivePerms(count ?? 0);
    } catch {
      /* ignore */
    }

    setLastUpdated(new Date());
  }, [user]);

  // ── Fetch permissions ────────────────────────────────────────────────
  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("card_issuances")
        .select("id, status, issued_at, card_instances(id, payload)")
        .in("status", ["issued", "accepted"])
        .order("issued_at", { ascending: false });
      setIssuances(data || []);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Fetch feed ───────────────────────────────────────────────────────
  const fetchFeed = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("get_my_recent_audit", { p_limit: 10 });
      setFeed(data || []);
    } catch {
      /* ignore */
    }
  }, []);

  // ── Intervals ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
    fetchPermissions();
    fetchFeed();
    const s = setInterval(fetchStats, STATS_INTERVAL);
    const f = setInterval(() => {
      fetchFeed();
      fetchPermissions();
    }, FEED_INTERVAL);
    return () => {
      clearInterval(s);
      clearInterval(f);
    };
  }, [fetchStats, fetchPermissions, fetchFeed]);

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
      fetchPermissions();
      fetchStats();
      fetchFeed();
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

  // ── Activate (accept pending) ───────────────────────────────────────
  const handleActivate = async (id: string, name: string) => {
    console.log("[Activate] issuance_id:", id, "agent:", name);
    console.log("[Activate] auth user:", user?.id, user?.email);
    try {
      const { data, error } = await supabase.rpc("resolve_card_issuance", {
        p_issuance_id: id,
        p_resolution: "accepted",
      });
      console.log("[Activate] RPC response — data:", data, "error:", error);
      if (error) {
        console.error("[Activate] Supabase error object:", JSON.stringify(error, null, 2));
        throw error;
      }
      toast({
        title: `Permission activated. ${name} now has access.`,
        description: "You can close the door at any time from this panel.",
      });
      fetchPermissions();
      fetchStats();
      fetchFeed();
    } catch (err: any) {
      console.error("[Activate] Caught error:", err);
      console.error("[Activate] Error message:", err?.message);
      console.error("[Activate] Error details:", err?.details);
      console.error("[Activate] Error hint:", err?.hint);
      console.error("[Activate] Error code:", err?.code);
      toast({
        title: "Could not activate permission",
        description: err?.message || "Unknown error. Check browser console for details.",
        variant: "destructive",
        duration: 8000,
      });
    }
  };

  const secondsAgo = Math.round((Date.now() - lastUpdated.getTime()) / 1000);

  return (
    <div className="space-y-0">
      {/* Banner moved to AppLayout — removed from page */}

      {/* ── SECTION 2: TWO-COLUMN ──────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6 pt-6">
        {/* LEFT: Front Door (Control 1) */}
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            🚪 My Front Door
          </h2>
          <p className="text-sm text-muted-foreground italic mb-4">
            Nothing reaches your data without checking here first.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Shield className="h-5 w-5 text-vault-green" />}
              label="Endpoint Status"
              value={
                endpointOk === null
                  ? "…"
                  : endpointOk
                    ? "✅ Active"
                    : "⚠️ Offline"
              }
              subLabel={endpointOk ? "Front door is active" : "Checking…"}
              variant={endpointOk === false ? "amber" : endpointOk ? "green" : "default"}
            />
            <StatCard
              icon={<Lock className="h-5 w-5 text-vault-navy" />}
              label="Data protected"
              value={dataCount}
              subLabel="health documents behind the door"
            />
            <StatCard
              icon={<ShieldCheck className="h-5 w-5 text-vault-navy" />}
              label="Door checks today"
              value={checksToday}
              subLabel="agents verified since midnight"
            />
            <StatCard
              icon={<KeyRound className="h-5 w-5 text-vault-green" />}
              label="Active permissions"
              value={activePerms}
              subLabel="agents with a permission slip"
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-2">
            Last updated {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}
          </p>
        </section>

        {/* RIGHT: Permissions (Control 2) */}
        <section>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            📋 My Permissions
          </h2>
          <p className="text-sm text-muted-foreground italic mb-4">
            Who has a permission slip right now.
          </p>

          {issuances.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No active permissions. Your data is behind the door, but no
                agent has a key.
              </p>
              <Button
                className="bg-vault-green hover:bg-vault-green/90 text-vault-green-foreground"
                onClick={() => navigate("/cards/use/new")}
              >
                + Write a new permission slip
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {issuances.map((iss) => (
                <PermissionCard
                  key={iss.id}
                  issuance={iss}
                  onRevoke={(id, name) => setRevokeTarget({ id, name })}
                  onActivate={handleActivate}
                />
              ))}
              <Button
                variant="link"
                className="text-vault-green p-0 h-auto"
                onClick={() => navigate("/cards/use/new")}
              >
                + Write a new permission slip
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* ── SECTION 3: ACTIVITY FEED ───────────────────────────────────── */}
      <section className="pt-8">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          🕐 Recent Door Activity
        </h2>
        <p className="text-sm text-muted-foreground italic mb-4">
          Every check at your front door — in plain English.
        </p>

        {feed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No activity yet. Events will appear here as agents check your front
            door.
          </p>
        ) : (
          <div className="space-y-0">
            {feed.map((entry: any, i: number) => {
              const meta = FEED_META[entry.action] || {
                icon: "⚪",
                color: "text-muted-foreground",
                label: entry.action?.replace(/_/g, " ") || "Event",
              };
              const ctx = entry.lifecycle_context;
              const agentHint =
                ctx?.agent_id || ctx?.issuer_id || ctx?.recipient_member_id;

              return (
                <div key={entry.id} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="text-lg leading-none mt-0.5">
                      {meta.icon}
                    </span>
                    {i < feed.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${meta.color}`}>
                      {meta.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {relativeTime(entry.created_at)}
                      {agentHint && (
                        <span className="ml-2 opacity-60">
                          · checked in
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button
          variant="link"
          className="text-vault-navy p-0 h-auto text-xs"
          onClick={() => navigate("/activity")}
        >
          View full activity log <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      </section>

      {/* ── REVOKE DIALOG ──────────────────────────────────────────────── */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to close the door?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{revokeTarget?.name}</strong>'s permission
              immediately. The action is permanent and logged. You can issue a
              new permission any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>
              Keep it open
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-vault-red hover:bg-vault-red/90"
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
