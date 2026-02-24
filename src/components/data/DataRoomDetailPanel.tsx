import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PROHIBITION_LABELS: Record<string, string> = {
  no_onward_sharing: "Cannot share your data",
  no_training: "Cannot train on your data",
  no_retention: "Cannot store your data",
};

const ENFORCEMENT_LABELS: Record<string, string> = {
  architectural: "(enforced by system)",
  contractual: "(enforced by agreement)",
};

const RETENTION_LABELS: Record<string, string> = {
  none: "No retention — data not stored after session",
  time_bound: "Stored for limited duration then deleted",
  indefinite: "Stored indefinitely",
};

const EVENT_LABELS: Record<string, { icon: string; label: string }> = {
  form_registered: { icon: "📋", label: "Form registered" },
  instance_created: { icon: "✨", label: "CARD created" },
  card_issued: { icon: "📤", label: "Permission sent" },
  card_accepted: { icon: "✅", label: "Permission accepted" },
  card_rejected: { icon: "❌", label: "Permission rejected" },
  card_superseded: { icon: "🔄", label: "CARD updated" },
  card_revoked: { icon: "🔒", label: "Permission revoked" },
  verification_queried: { icon: "🚪", label: "Front door checked" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d remaining`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours}h remaining`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
      {children}
    </h4>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="break-all">{children}</span>
    </div>
  );
}

interface AgentAccess {
  agentName: string;
  expiresAt: string | null;
}

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
}

interface DataRoomDetailPanelProps {
  open: boolean;
  onClose: () => void;
  room: { id: string; payload: any; created_at: string } | null;
}

export function DataRoomDetailPanel({ open, onClose, room }: DataRoomDetailPanelProps) {
  const [agents, setAgents] = useState<AgentAccess[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const p = room?.payload;
  const card = p?.card || {};
  const claim = p?.claims?.items?.[0];
  const sensitivity = claim?.sensitivity?.level;
  const resourceName = claim?.resource?.display_name || claim?.resource?.uri || "Unknown";
  const storage = claim?.resource?.storage;
  const actions = claim?.constraints?.allowed_actions;
  const purposeLabel = claim?.constraints?.purpose?.[0]?.label;
  const prohibitions = p?.policy?.prohibitions;
  const retention = p?.policy?.retention?.mode;

  const storageLabel = storage === "pdv" ? "Personal Data Vault" : storage || undefined;

  useEffect(() => {
    if (!open || !room) {
      setAgents([]);
      setAuditEvents([]);
      return;
    }

    async function loadDetails() {
      setLoading(true);

      // 1. Find agents with active access via Use CARDs referencing this resource URI
      const resourceUri = claim?.resource?.uri;
      const agentList: AgentAccess[] = [];

      if (resourceUri) {
        const { data: issuances } = await supabase
          .from("card_issuances")
          .select("id, instance_id")
          .eq("status", "accepted");

        if (issuances && issuances.length > 0) {
          const instanceIds = issuances.map((i) => i.instance_id);
          const { data: instances } = await supabase
            .from("card_instances")
            .select("id, payload, form_id")
            .in("id", instanceIds);

          const { data: forms } = await supabase
            .from("card_forms")
            .select("id")
            .eq("form_type", "use");

          const useFormIds = new Set((forms || []).map((f) => f.id));

          (instances || []).forEach((inst: any) => {
            if (!useFormIds.has(inst.form_id)) return;
            const claims = inst.payload?.claims?.items || [];
            const refsResource = claims.some(
              (c: any) => c.resource?.uri === resourceUri
            );
            if (!refsResource) return;

            const agentParties = inst.payload?.parties?.agents || [];
            const agentName =
              agentParties[0]?.display_name ||
              inst.payload?.card?.title ||
              "Unknown agent";
            const expiresAt =
              inst.payload?.policy?.consent?.grants?.[0]?.effective?.to || null;
            agentList.push({ agentName, expiresAt });
          });
        }
      }

      // 2. Audit trail for this instance
      const { data: audit } = await supabase.rpc("get_audit_trail", {
        p_entity_type: "card_instance",
        p_entity_id: room!.id,
      });

      setAgents(agentList);
      setAuditEvents(
        ((audit as any[]) || [])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
      setLoading(false);
    }

    loadDetails();
  }, [open, room?.id]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-xl font-bold">{card.title || "Untitled resource"}</SheetTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </div>
          {sensitivity === "high" && (
            <Badge variant="destructive" className="text-xs w-fit">
              🔴 HIGH SENSITIVITY
            </Badge>
          )}
        </SheetHeader>

        <div className="space-y-6">
          {/* What this is */}
          <div>
            <SectionHeading>What this is</SectionHeading>
            <div className="space-y-1.5">
              <Field label="Resource">{resourceName}</Field>
              {room?.created_at && (
                <Field label="Protected since">{formatDate(room.created_at)}</Field>
              )}
              {storageLabel && (
                <Field label="Storage location">{storageLabel}</Field>
              )}
            </div>
          </div>

          {/* What agents can do */}
          <div>
            <SectionHeading>What agents can do with it</SectionHeading>
            <div className="space-y-2">
              {Array.isArray(actions) && actions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Allowed actions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a: string) => (
                      <span key={a} className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {purposeLabel && <Field label="Purpose">{purposeLabel}</Field>}
            </div>
          </div>

          {/* Rules */}
          {(Array.isArray(prohibitions) && prohibitions.length > 0) || retention ? (
            <div>
              <SectionHeading>Rules</SectionHeading>
              <div className="space-y-2">
                {Array.isArray(prohibitions) && prohibitions.map((pr: any) => {
                  const code = typeof pr === "string" ? pr : pr?.code;
                  const tier = typeof pr === "object" ? pr?.enforcement : undefined;
                  const label = PROHIBITION_LABELS[code] || code?.replace(/_/g, " ") || "Unknown";
                  return (
                    <div key={code} className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 border border-red-200 px-2.5 py-0.5 text-xs font-medium">
                        {label}
                      </span>
                      {tier && (
                        <span className="text-[11px] text-muted-foreground">
                          {ENFORCEMENT_LABELS[tier] || tier}
                        </span>
                      )}
                    </div>
                  );
                })}
                {retention && (
                  <Field label="Retention">
                    {RETENTION_LABELS[retention] || retention}
                  </Field>
                )}
              </div>
            </div>
          ) : null}

          {/* Who has access */}
          <div>
            <SectionHeading>Who has access right now</SectionHeading>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : agents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No agents currently have access. Your data is behind the door.
              </p>
            ) : (
              <div className="space-y-2">
                {agents.map((agent, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1 bg-muted/30">
                    <p className="text-sm font-medium">{agent.agentName}</p>
                    {agent.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {formatDate(agent.expiresAt)} ({countdown(agent.expiresAt)})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div>
            <SectionHeading>History</SectionHeading>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditEvents.map((evt) => {
                  const meta = EVENT_LABELS[evt.action] || { icon: "📌", label: evt.action.replace(/_/g, " ") };
                  return (
                    <div key={evt.id} className="flex items-start gap-2 text-sm">
                      <span>{meta.icon}</span>
                      <div>
                        <p>{meta.label}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(evt.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
