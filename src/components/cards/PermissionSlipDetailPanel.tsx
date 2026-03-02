import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function countdown(iso: string): { label: string; urgent: boolean; expired: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "Expired", urgent: false, expired: true };
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return { label: `Expires in ${hours}h ${mins}m`, urgent: hours < 2, expired: false };
  return { label: `Expires in ${mins}m`, urgent: true, expired: false };
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

interface AuditEvent {
  id: string;
  action: string;
  created_at: string;
}

interface PermissionSlipDetailPanelProps {
  open: boolean;
  onClose: () => void;
  issuance: {
    id: string;
    status: string;
    issued_at: string;
    resolved_at: string | null;
    card_instances: { id: string; payload: any } | null;
  } | null;
  onRevoke?: (id: string, name: string) => void;
  onActivate?: (id: string, name: string) => void;
}

export function PermissionSlipDetailPanel({
  open,
  onClose,
  issuance,
  onRevoke,
  onActivate,
}: PermissionSlipDetailPanelProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    authorized: boolean;
    timestamp: string;
    entityStatus: string;
  } | null>(null);

  const payload = issuance?.card_instances?.payload as any;
  const card = payload?.card || {};
  const agent = payload?.parties?.agents?.[0];
  const claims = payload?.claims?.items || [];
  const claim0 = claims[0];
  const actions = claim0?.constraints?.allowed_actions;
  const purposeLabel = claim0?.constraints?.purpose?.[0]?.label;
  const prohibitions = payload?.policy?.prohibitions;
  const retention = payload?.policy?.retention?.mode;
  const expiresIso = payload?.policy?.consent?.grants?.[0]?.effective?.to;
  const agentName = agent?.display_name || card.title || "Unknown agent";

  const statusVariant = issuance?.status;

  useEffect(() => {
    if (!open || !issuance) {
      setAuditEvents([]);
      return;
    }
    async function loadAudit() {
      setLoadingAudit(true);
      const { data } = await supabase.rpc("get_audit_trail", {
        p_entity_type: "card_issuance",
        p_entity_id: issuance!.id,
      });
      setAuditEvents(
        ((data as any[]) || []).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      setLoadingAudit(false);
    }
    loadAudit();
  }, [open, issuance?.id]);

  const handleTestVerify = async () => {
    if (!issuance || verifying) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const agentId =
        agent?.id ||
        payload?.card?.id ||
        (issuance.card_instances?.id ? `urn:uuid:${issuance.card_instances.id}` : null);

      if (!agentId) {
        setVerifyResult({ authorized: false, timestamp: new Date().toISOString(), entityStatus: "no_agent_id" });
        return;
      }

      const { data, error } = await supabase.functions.invoke("demo-verify", {
        body: {
          agent_id: agentId,
          card_ref: issuance.card_instances?.id ? `urn:uuid:${issuance.card_instances.id}` : undefined,
        },
      });

      if (error) throw error;

      const isAuthorized =
        data?.entity_status === "active" &&
        Array.isArray(data?.active_use_cards) &&
        data.active_use_cards.length > 0;

      setVerifyResult({
        authorized: isAuthorized,
        timestamp: data?.verified_at || new Date().toISOString(),
        entityStatus: data?.entity_status || "unknown",
      });
    } catch (err: any) {
      console.error("Verification test failed:", err);
      setVerifyResult({ authorized: false, timestamp: new Date().toISOString(), entityStatus: "error" });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Permission slip
          </p>
          <SheetTitle className="text-xl font-bold">{card.title || "Untitled permission"}</SheetTitle>
          <div className="flex items-center gap-2">
            {statusVariant === "accepted" && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-600 mr-1" />
                Active
              </Badge>
            )}
            {statusVariant === "issued" && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-600 mr-1" />
                Waiting for approval
              </Badge>
            )}
            {statusVariant === "revoked" && (
              <Badge variant="secondary" className="text-xs">
                Closed
              </Badge>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Who */}
          {agent && (
            <div>
              <SectionHeading>Who</SectionHeading>
              <div className="space-y-1.5">
                <Field label="Agent">{agent.display_name || "Unknown"}</Field>
                {agent.operator?.id && (
                  <Field label="Operated by">
                    <CopyIdButton value={agent.operator.id} variant="inline" />
                  </Field>
                )}
                {agent.model && (
                  <Field label="Model">
                    {agent.model.provider} / {agent.model.name}
                  </Field>
                )}
              </div>
            </div>
          )}

          {/* What they can see */}
          {claims.length > 0 && (
            <div>
              <SectionHeading>What they can see</SectionHeading>
              <div className="space-y-2">
                {claims.map((c: any, i: number) => {
                  const name = c?.resource?.display_name || c?.resource?.uri?.split("/").pop() || "Unknown";
                  const isHigh = c?.sensitivity?.level === "high";
                  return (
                    <div key={i} className="rounded-md border p-3 bg-muted/30 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      {isHigh && (
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          🔴 HIGH SENSITIVITY
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* What they can do */}
          {(actions || purposeLabel) && (
            <div>
              <SectionHeading>What they can do</SectionHeading>
              <div className="space-y-2">
                {Array.isArray(actions) && actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a: string) => (
                      <span
                        key={a}
                        className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium"
                      >
                        {a.charAt(0).toUpperCase() + a.slice(1)}
                      </span>
                    ))}
                  </div>
                )}
                {purposeLabel && <Field label="Purpose">{purposeLabel}</Field>}
              </div>
            </div>
          )}

          {/* Rules */}
          {(Array.isArray(prohibitions) && prohibitions.length > 0) || retention ? (
            <div>
              <SectionHeading>Rules</SectionHeading>
              <div className="space-y-2">
                {Array.isArray(prohibitions) &&
                  prohibitions.map((pr: any) => {
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
                  <Field label="Retention">{RETENTION_LABELS[retention] || retention}</Field>
                )}
              </div>
            </div>
          ) : null}

          {/* Duration */}
          <div>
            <SectionHeading>Duration</SectionHeading>
            <div className="space-y-1.5">
              {issuance?.issued_at && (
                <Field label="Issued">{formatDateTime(issuance.issued_at)}</Field>
              )}
              {expiresIso && (
                <Field label="Expires">{formatDateTime(expiresIso)}</Field>
              )}
              {statusVariant === "accepted" && expiresIso && (() => {
                const cd = countdown(expiresIso);
                return (
                  <p
                    className={`text-xs font-medium ${
                      cd.expired
                        ? "text-destructive"
                        : cd.urgent
                          ? "text-[hsl(var(--vault-amber))]"
                          : "text-muted-foreground"
                    }`}
                  >
                    ⏳ {cd.label}
                  </p>
                );
              })()}
              {statusVariant === "revoked" && issuance?.resolved_at && (
                <Field label="Closed at">{formatDateTime(issuance.resolved_at)}</Field>
              )}
            </div>
          </div>

          {/* History */}
          <div>
            <SectionHeading>History</SectionHeading>
            {loadingAudit ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : auditEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditEvents.map((evt) => {
                  const meta = EVENT_LABELS[evt.action] || {
                    icon: "📌",
                    label: evt.action.replace(/_/g, " "),
                  };
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

          {/* Test Verification */}
          <div>
            <SectionHeading>Verification endpoint</SectionHeading>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleTestVerify}
              disabled={verifying}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                "Test Verification Endpoint"
              )}
            </Button>

            {verifyResult && (
              <div className="mt-3 rounded-lg border p-4 text-center space-y-2">
                {verifyResult.authorized ? (
                  <p className="text-2xl font-bold text-emerald-600">✅ AUTHORIZED</p>
                ) : (
                  <p className="text-2xl font-bold text-destructive">🔒 DENIED</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Checked at {formatDateTime(verifyResult.timestamp)}
                </p>
              </div>
            )}
          </div>


          {statusVariant === "accepted" && onRevoke && (
            <Button
              variant="destructive"
              className="w-full bg-[hsl(var(--vault-red))] hover:bg-[hsl(var(--vault-red))]/90 text-[hsl(var(--vault-red-foreground))]"
              onClick={() => {
                onRevoke(issuance!.id, agentName);
                onClose();
              }}
            >
              Close the door
            </Button>
          )}
          {statusVariant === "issued" && onActivate && (
            <Button
              className="w-full bg-[hsl(var(--vault-green))] hover:bg-[hsl(var(--vault-green))]/90 text-[hsl(var(--vault-green-foreground))]"
              onClick={() => {
                onActivate(issuance!.id, agentName);
                onClose();
              }}
            >
              Activate permission
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
