import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/QueryState";

// ── Event metadata ───────────────────────────────────────────────────────
const EVENT_META: Record<string, { icon: string; color: string }> = {
  verification_queried: { icon: "🚪", color: "text-blue-600" },
  card_issued:          { icon: "📋", color: "text-vault-green" },
  card_accepted:        { icon: "✅", color: "text-vault-green" },
  issuance_accepted:    { icon: "✅", color: "text-vault-green" },
  card_revoked:         { icon: "🔒", color: "text-vault-red" },
  issuance_revoked:     { icon: "🔒", color: "text-vault-red" },
  instance_created:     { icon: "📄", color: "text-muted-foreground" },
  card_superseded:      { icon: "🔄", color: "text-muted-foreground" },
  instance_superseded:  { icon: "🔄", color: "text-muted-foreground" },
};

function getMeta(action: string) {
  return EVENT_META[action] || { icon: "⚪", color: "text-muted-foreground" };
}

function describeEvent(action: string, ctx: any): string {
  const agentName = ctx?.agent_display_name || ctx?.agent_name || ctx?.agent_id || "";
  const entityStatus = ctx?.entity_status || "";
  const formType = ctx?.form_type || "";
  const title = ctx?.title || ctx?.card_title || ctx?.form_name || "";
  const dataTitles = ctx?.data_titles || "";

  switch (action) {
    case "card_issued": {
      let desc = "Permission sent";
      if (agentName) desc += ` — ${agentName}`;
      if (dataTitles) desc += ` — covers: ${dataTitles}`;
      return desc;
    }
    case "card_accepted":
    case "issuance_accepted":
      return `Permission activated${agentName ? ` — ${agentName} now has access` : ""}`;
    case "card_revoked":
    case "issuance_revoked":
      return `Door closed${agentName ? ` — ${agentName}'s permission was revoked` : ""}`;
    case "verification_queried": {
      let desc = "Front door checked";
      if (agentName) desc += ` — ${agentName}`;
      if (entityStatus) desc += ` — result: ${entityStatus}`;
      return desc;
    }
    case "instance_created":
      return `New ${formType || "CARD"} created${title ? ` — ${title}` : ""}`;
    case "card_superseded":
    case "instance_superseded":
      return "CARD rebuilt — updated to current specification";
    case "form_registered":
      return `Form registered${title ? ` — ${title}` : ""}`;
    default:
      return action.replace(/_/g, " ");
  }
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " — " +
    d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true })
  );
}

type Filter = "all" | "permissions" | "door_checks";
const PERM_ACTIONS = ["card_issued", "card_accepted", "issuance_accepted", "card_revoked", "issuance_revoked"];
const DOOR_ACTIONS = ["verification_queried"];

export default function Activity() {
  usePageTitle(useLocation().pathname);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const [doorChecks, setDoorChecks] = useState(0);
  const [permsSent, setPermsSent] = useState(0);
  const [permsActivated, setPermsActivated] = useState(0);
  const [doorsClosed, setDoorsClosed] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("audit_log")
      .select("id, action, entity_id, lifecycle_context, created_at")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setEvents(rows);

    let dc = 0, ps = 0, pa = 0, dcl = 0;
    rows.forEach((r: any) => {
      if (r.action === "verification_queried") dc++;
      if (r.action === "card_issued") ps++;
      if (r.action === "card_accepted" || r.action === "issuance_accepted") pa++;
      if (r.action === "card_revoked" || r.action === "issuance_revoked") dcl++;
    });
    setDoorChecks(dc);
    setPermsSent(ps);
    setPermsActivated(pa);
    setDoorsClosed(dcl);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered =
    filter === "all"
      ? events
      : filter === "permissions"
        ? events.filter((e) => PERM_ACTIONS.includes(e.action))
        : events.filter((e) => DOOR_ACTIONS.includes(e.action));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Activities &amp; Reports</h1>
        <p className="text-sm text-muted-foreground">
          Every action at your front door — permanent and tamper-evident.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        <StatChip icon="🚪" label="Door checks today" count={doorChecks} />
        <StatChip icon="📋" label="Permission slips sent" count={permsSent} />
        <StatChip icon="✅" label="Ever activated" count={permsActivated} />
        <StatChip icon="🔒" label="Ever closed" count={doorsClosed} />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        {(["all", "permissions", "door_checks"] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "permissions" ? "Permissions" : "Door checks"}
          </Button>
        ))}
      </div>

      <QueryState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={filtered.length === 0}
        emptyMessage={
          events.length === 0
            ? "No activity recorded yet. Activity appears here as you use Opn.li Agent Safe."
            : "No events match this filter."
        }
      >
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-1 bottom-1 w-px bg-border" />
          <div className="space-y-0">
            {filtered.map((evt: any) => {
              const meta = getMeta(evt.action);
              const ctx = (evt.lifecycle_context || {}) as any;
              return (
                <div key={evt.id} className="relative pb-6">
                  <div className="absolute -left-6 top-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border text-xs">
                    {meta.icon}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground/70">
                      {formatTimestamp(evt.created_at)}
                    </p>
                    <p className={`text-sm font-medium ${meta.color}`}>
                      {describeEvent(evt.action, ctx)}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
        </div>
      </QueryState>
    </div>
  );
}

function StatChip({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
      <span className="text-sm">{icon}</span>
      <span className="text-sm font-medium">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
