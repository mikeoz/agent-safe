import { Badge } from "@/components/ui/badge";
import { CardTypeBadge } from "@/components/CardTypeBadge";

interface CardContentRendererProps {
  payload: any;
  formType: string;
  formName: string;
  issuedAt?: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

export function CardContentRenderer({ payload, formType, formName, issuedAt }: CardContentRendererProps) {
  const card = payload?.card || {};
  const parties = payload?.parties || {};
  const claims = payload?.claims?.items || [];
  const policy = payload?.policy || {};
  const lifecycle = payload?.lifecycle || {};

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">{card.title || "Untitled CARD"}</h3>
          <CardTypeBadge formType={formType} />
        </div>
        <p className="text-sm text-muted-foreground">{formName}</p>
        {issuedAt && (
          <p className="text-xs text-muted-foreground">
            Issued {new Date(issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </div>

      {/* ── Parties ── */}
      <Section title="Parties">
        <Field label="Subject" value={parties.subject?.display_name || parties.subject?.id} />
        <Field label="Subject Kind" value={parties.subject?.kind} />
        {parties.holder && <Field label="Holder" value={parties.holder.id} />}

        {formType === "data" && Array.isArray(parties.recipients) && (
          <div className="text-sm">
            <span className="text-muted-foreground">Recipients: </span>
            {parties.recipients.map((r: any, i: number) => (
              <span key={i}>{r.display_name || r.id}{i < parties.recipients.length - 1 ? ", " : ""}</span>
            ))}
          </div>
        )}

        {formType === "use" && Array.isArray(parties.agents) && parties.agents.length > 0 && (
          <>
            <Field label="Agent" value={parties.agents[0].display_name || parties.agents[0].id} />
            <Field label="Operator" value={parties.agents[0].operator?.id} />
            {Array.isArray(parties.agents[0].capabilities) && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-sm text-muted-foreground">Capabilities:</span>
                {parties.agents[0].capabilities.map((c: string) => (
                  <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Claims ── */}
      <Section title="Claims">
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground">No claims</p>
        ) : (
          claims.map((claim: any, idx: number) => (
            <div key={idx} className="rounded-md border p-3 space-y-1.5 bg-muted/30">
              <Field label="Category" value={claim.category} />

              {claim.resource?.uri && <Field label="Data Resource" value={claim.resource.uri} />}

              {Array.isArray(claim.constraints?.allowed_actions) && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-sm text-muted-foreground">Allowed Actions:</span>
                  {claim.constraints.allowed_actions.map((a: string) => (
                    <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                  ))}
                </div>
              )}

              {Array.isArray(claim.constraints?.purpose) && claim.constraints.purpose.length > 0 && (
                <Field label="Purpose" value={claim.constraints.purpose.map((p: any) => p.label || p.code).join(", ")} />
              )}
            </div>
          ))
        )}
      </Section>

      {/* ── Policy ── */}
      <Section title="Policy">
        <Field label="Consent Basis" value={policy.consent?.basis} />

        {formType === "data" && (
          <>
            <Field label="Retention Mode" value={policy.retention?.mode} />
            <Field label="Revocation Supported" value={policy.revocation?.supported ? "Yes" : "No"} />
          </>
        )}

        {formType === "use" && Array.isArray(policy.consent?.grants) && policy.consent.grants.length > 0 && (
          <>
            <Field label="Grant To" value={policy.consent.grants[0].to?.id} />
            {policy.consent.grants[0].effective && (
              <Field
                label="Grant Period"
                value={`${new Date(policy.consent.grants[0].effective.from).toLocaleDateString()} – ${new Date(policy.consent.grants[0].effective.to).toLocaleDateString()}`}
              />
            )}
          </>
        )}

        {Array.isArray(policy.prohibitions) && policy.prohibitions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-sm text-muted-foreground">Prohibitions:</span>
            {policy.prohibitions.map((p: string) => (
              <Badge key={p} variant="destructive" className="text-xs">{p.replace(/_/g, " ")}</Badge>
            ))}
          </div>
        )}
      </Section>

      {/* ── Lifecycle ── */}
      <Section title="Lifecycle">
        <Field label="Status" value={lifecycle.status} />
      </Section>
    </div>
  );
}
