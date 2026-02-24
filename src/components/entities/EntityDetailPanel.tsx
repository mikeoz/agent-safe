import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { supabase } from "@/integrations/supabase/client";

const KIND_STYLE: Record<string, string> = {
  agent: "bg-teal-100 text-teal-800 border-teal-200",
  person: "bg-blue-100 text-blue-800 border-blue-200",
  org: "bg-gray-100 text-gray-700 border-gray-200",
};

const PROHIBITION_LABELS: Record<string, string> = {
  no_onward_sharing: "Cannot share your data",
  no_training: "Cannot train on your data",
  no_retention: "Cannot store your data",
};

const ENFORCEMENT_LABELS: Record<string, string> = {
  architectural: "(enforced by system)",
  contractual: "(enforced by agreement)",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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

interface PermissionSlip {
  title: string;
  resourceName: string;
  expiresAt: string | null;
}

interface EntityDetailPanelProps {
  open: boolean;
  onClose: () => void;
  entity: {
    id: string;
    payload: any;
    created_at: string;
  } | null;
}

export function EntityDetailPanel({ open, onClose, entity }: EntityDetailPanelProps) {
  const [permissionSlips, setPermissionSlips] = useState<PermissionSlip[]>([]);
  const [loadingSlips, setLoadingSlips] = useState(false);

  const p = entity?.payload;
  const subject = p?.parties?.subject;
  const operator = p?.parties?.operator;
  const claim = p?.claims?.items?.[0];
  const caps = claim?.agent_metadata?.capabilities;
  const model = claim?.agent_metadata?.model;
  const prohibitions = p?.policy?.prohibitions;
  const lifecycle = p?.lifecycle;
  const agentId = subject?.id || "";
  const kind = subject?.kind || "entity";
  const name = subject?.display_name || p?.card?.title || "Unnamed";

  useEffect(() => {
    if (!open || !agentId) {
      setPermissionSlips([]);
      return;
    }

    async function loadSlips() {
      setLoadingSlips(true);
      try {
        // Find accepted issuances where the Use CARD references this agent
        const { data: issuances } = await supabase
          .from("card_issuances")
          .select("id, instance_id, issued_at")
          .eq("status", "accepted");

        if (!issuances || issuances.length === 0) {
          setPermissionSlips([]);
          setLoadingSlips(false);
          return;
        }

        const instanceIds = issuances.map((i) => i.instance_id);
        const { data: instances } = await supabase
          .from("card_instances")
          .select("id, payload, form_id")
          .in("id", instanceIds);

        // Get use form id
        const { data: forms } = await supabase
          .from("card_forms")
          .select("id")
          .eq("form_type", "use");

        const useFormIds = new Set((forms || []).map((f) => f.id));

        const slips: PermissionSlip[] = [];
        (instances || []).forEach((inst: any) => {
          if (!useFormIds.has(inst.form_id)) return;
          const agents = inst.payload?.parties?.agents;
          if (!Array.isArray(agents)) return;
          const matches = agents.some((a: any) => a.id === agentId);
          if (!matches) return;

          const resource = inst.payload?.claims?.items?.[0]?.resource?.uri || "Unknown resource";
          const expiresAt = inst.payload?.policy?.consent?.grants?.[0]?.effective?.to || null;
          slips.push({
            title: inst.payload?.card?.title || "Use CARD",
            resourceName: resource,
            expiresAt,
          });
        });

        setPermissionSlips(slips);
      } catch {
        setPermissionSlips([]);
      }
      setLoadingSlips(false);
    }

    loadSlips();
  }, [open, agentId]);

  function countdown(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d remaining`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return `${hours}h remaining`;
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <SheetTitle className="text-xl font-bold">{name}</SheetTitle>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${KIND_STYLE[kind] || KIND_STYLE.org}`}>
              {kind}
            </span>
          </div>
          {lifecycle?.status === "active" && (
            <span className="inline-flex items-center gap-1 text-xs text-vault-green font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-vault-green" />
              Active
            </span>
          )}
          {lifecycle?.status && lifecycle.status !== "active" && (
            <span className="text-xs text-muted-foreground capitalize">{lifecycle.status}</span>
          )}
        </SheetHeader>

        <div className="space-y-6">
          {/* Identity */}
          <div>
            <SectionHeading>Identity</SectionHeading>
            <div className="space-y-1.5">
              {agentId && (
                <Field label="Agent URI">
                  <CopyIdButton value={agentId} variant="inline" />
                </Field>
              )}
              {entity?.created_at && (
                <Field label="Registered">{formatDate(entity.created_at)}</Field>
              )}
            </div>
          </div>

          {/* Operator */}
          {operator && (
            <div>
              <SectionHeading>Operator</SectionHeading>
              <div className="space-y-1.5">
                {operator.display_name && (
                  <Field label="Operated by">{operator.display_name}</Field>
                )}
                {operator.id && (
                  <Field label="Operator ID">
                    <CopyIdButton value={operator.id} variant="inline" />
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* Capabilities */}
          {(caps || model) && (
            <div>
              <SectionHeading>Capabilities</SectionHeading>
              <div className="space-y-2">
                {Array.isArray(caps) && caps.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">What this agent can do</p>
                    <div className="flex flex-wrap gap-1.5">
                      {caps.map((c: string) => (
                        <span key={c} className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {model && (
                  <Field label="Model">{model.provider} / {model.name}</Field>
                )}
              </div>
            </div>
          )}

          {/* Rules */}
          {Array.isArray(prohibitions) && prohibitions.length > 0 && (
            <div>
              <SectionHeading>Rules</SectionHeading>
              <div className="space-y-1.5">
                {prohibitions.map((pr: any) => {
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
              </div>
            </div>
          )}

          {/* Active Permission Slips */}
          <div>
            <SectionHeading>Active Permission Slips</SectionHeading>
            {loadingSlips ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : permissionSlips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active permission slips</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {permissionSlips.length} active permission slip{permissionSlips.length !== 1 ? "s" : ""}
                </p>
                {permissionSlips.map((slip, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1 bg-muted/30">
                    <p className="text-sm font-medium">{slip.title}</p>
                    <p className="text-xs text-muted-foreground">Resource: {slip.resourceName}</p>
                    {slip.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Expires: {formatDate(slip.expiresAt)} ({countdown(slip.expiresAt)})
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
