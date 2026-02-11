import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormSection } from "./FormSection";
import { FieldRow } from "./FieldRow";
import { buildPayload } from "./buildPayload";
import {
  CardFormValues,
  PARTY_KINDS,
  CONSENT_BASES,
  LIFECYCLE_STATUSES,
  RETENTION_MODES,
  ALLOWED_ACTIONS_OPTIONS,
  ENTITY_CLAIM_CATEGORIES,
  CARD_TYPE_URLS,
} from "./types";

interface DynamicCardFormProps {
  formType: "entity" | "data" | "use";
  formId: string;
  onSubmit: (formId: string, payload: object) => Promise<void>;
  submitting: boolean;
  initialPayload?: any;
  submitLabel?: string;
}

function generateUrn() {
  return `urn:uuid:${crypto.randomUUID()}`;
}

export function DynamicCardForm({ formType, formId, onSubmit, submitting, initialPayload, submitLabel }: DynamicCardFormProps) {
  const [values, setValues] = useState<CardFormValues>(() => {
    const p = initialPayload;
    if (p) {
      // Pre-populate from existing payload, regenerating auto-generated IDs
      return {
        cardId: generateUrn(),
        cardType: p.card?.type || CARD_TYPE_URLS[formType] || "",
        cardTitle: p.card?.title || "",
        subjectId: p.parties?.subject?.id || "",
        subjectKind: p.parties?.subject?.kind || "person",
        subjectDisplayName: p.parties?.subject?.display_name || "",
        holderId: p.parties?.holder?.id || "",
        holderKind: p.parties?.holder?.kind || "person",
        recipientId: p.parties?.recipients?.[0]?.id || "",
        recipientKind: p.parties?.recipients?.[0]?.kind || "person",
        agentId: p.parties?.agents?.[0]?.id || "",
        agentOperatorId: p.parties?.agents?.[0]?.operator?.id || "",
        agentCapabilities: (p.parties?.agents?.[0]?.capabilities || []).join(", "),
        claimId: generateUrn(),
        claimCategory: p.claims?.items?.[0]?.category || (formType === "entity" ? "attestation" : "data"),
        resourceUri: p.claims?.items?.[0]?.resource?.uri || "",
        resourceStorage: p.claims?.items?.[0]?.resource?.storage || "",
        allowedActions: p.claims?.items?.[0]?.constraints?.allowed_actions || ["read"],
        purposeCode: p.claims?.items?.[0]?.constraints?.purpose?.[0]?.code || "",
        consentBasis: p.policy?.consent?.basis || "explicit",
        retentionMode: p.policy?.retention?.mode || "none",
        grantToId: p.policy?.consent?.grants?.[0]?.to?.id || "",
        grantEffectiveFrom: p.policy?.consent?.grants?.[0]?.effective?.from || "",
        grantEffectiveTo: p.policy?.consent?.grants?.[0]?.effective?.to || "",
        lifecycleStatus: p.lifecycle?.status || "draft",
      };
    }
    return {
      cardId: generateUrn(),
      cardType: CARD_TYPE_URLS[formType] || "",
      cardTitle: "",
      subjectId: "",
      subjectKind: "person",
      subjectDisplayName: "",
      holderId: "",
      holderKind: "person",
      recipientId: "",
      recipientKind: "person",
      agentId: "",
      agentOperatorId: "",
      agentCapabilities: "",
      claimId: generateUrn(),
      claimCategory: formType === "entity" ? "attestation" : "data",
      resourceUri: "",
      resourceStorage: "",
      allowedActions: ["read"],
      purposeCode: "",
      consentBasis: "explicit",
      retentionMode: "none",
      grantToId: "",
      grantEffectiveFrom: "",
      grantEffectiveTo: "",
      lifecycleStatus: "draft",
    };
  });

  const [errors, setErrors] = useState<string[]>([]);

  const set = <K extends keyof CardFormValues>(key: K, val: CardFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!values.cardTitle.trim()) errs.push("card.title is required");
    if (!values.subjectId.trim()) errs.push("parties.subject.id is required");
    if (formType === "entity" && !values.subjectDisplayName.trim())
      errs.push("parties.subject.display_name is required");
    if ((formType === "entity" || formType === "data") && !values.holderId.trim())
      errs.push("parties.holder.id is required");
    if (formType === "data" && !values.recipientId.trim())
      errs.push("parties.recipients[0].id is required");
    if (formType === "use") {
      if (!values.agentId.trim()) errs.push("parties.agents[0].id is required");
      if (!values.agentOperatorId.trim()) errs.push("parties.agents[0].operator.id is required");
      if (!values.agentCapabilities.trim()) errs.push("parties.agents[0].capabilities is required");
    }
    if (formType !== "entity") {
      if (!values.resourceUri.trim()) errs.push("claims.items[0].resource.uri is required");
      if (values.allowedActions.length === 0) errs.push("At least one allowed action is required");
      if (!values.purposeCode.trim()) errs.push("claims.items[0].constraints.purpose is required");
    }
    if (formType === "use") {
      if (!values.grantToId.trim()) errs.push("policy.consent.grants[0].to.id is required");
      if (!values.grantEffectiveFrom) errs.push("Grant effective-from date is required");
      if (!values.grantEffectiveTo) errs.push("Grant effective-to date is required");
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = buildPayload(values, formType);
    await onSubmit(formId, payload);
  };

  const toggleAction = (action: string) => {
    setValues((prev) => {
      const current = prev.allowedActions;
      const next = current.includes(action)
        ? current.filter((a) => a !== action)
        : [...current, action];
      return { ...prev, allowedActions: next };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ── Card Section ── */}
      <FormSection title="Card">
        <FieldRow label="card.id" required>
          <Input value={values.cardId} readOnly className="font-mono text-xs bg-muted" />
        </FieldRow>
        <FieldRow label="card.type" required>
          <Input value={values.cardType} readOnly className="font-mono text-xs bg-muted" />
        </FieldRow>
        <FieldRow label="card.title" htmlFor="cardTitle" required>
          <Input
            id="cardTitle"
            value={values.cardTitle}
            onChange={(e) => set("cardTitle", e.target.value)}
            placeholder="e.g. Personal Identity Card"
          />
        </FieldRow>
      </FormSection>

      {/* ── Parties Section ── */}
      <FormSection title="Parties">
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldRow label="parties.subject.id" htmlFor="subjectId" required>
            <Input
              id="subjectId"
              value={values.subjectId}
              onChange={(e) => set("subjectId", e.target.value)}
              placeholder="urn:uuid:member-001"
            />
          </FieldRow>
          <FieldRow label="parties.subject.kind" required>
            <Select value={values.subjectKind} onValueChange={(v) => set("subjectKind", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARTY_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>{k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        {formType === "entity" && (
          <FieldRow label="parties.subject.display_name" htmlFor="subjectDisplayName" required>
            <Input
              id="subjectDisplayName"
              value={values.subjectDisplayName}
              onChange={(e) => set("subjectDisplayName", e.target.value)}
              placeholder="Jane Doe"
            />
          </FieldRow>
        )}

        {(formType === "entity" || formType === "data") && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="parties.holder.id" htmlFor="holderId" required>
              <Input
                id="holderId"
                value={values.holderId}
                onChange={(e) => set("holderId", e.target.value)}
                placeholder="urn:uuid:holder-001"
              />
            </FieldRow>
            <FieldRow label="parties.holder.kind" required>
              <Select value={values.holderKind} onValueChange={(v) => set("holderKind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        )}

        {formType === "data" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="parties.recipients[0].id" htmlFor="recipientId" required>
              <Input
                id="recipientId"
                value={values.recipientId}
                onChange={(e) => set("recipientId", e.target.value)}
                placeholder="urn:uuid:recipient-001"
              />
            </FieldRow>
            <FieldRow label="parties.recipients[0].kind" required>
              <Select value={values.recipientKind} onValueChange={(v) => set("recipientKind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{k}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        )}

        {formType === "use" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="parties.agents[0].id" htmlFor="agentId" required>
                <Input
                  id="agentId"
                  value={values.agentId}
                  onChange={(e) => set("agentId", e.target.value)}
                  placeholder="urn:uuid:agent-001"
                />
              </FieldRow>
              <FieldRow label="parties.agents[0].kind">
                <Input value="agent" readOnly className="bg-muted text-xs" />
              </FieldRow>
            </div>
            <FieldRow label="parties.agents[0].operator.id" htmlFor="agentOperatorId" required>
              <Input
                id="agentOperatorId"
                value={values.agentOperatorId}
                onChange={(e) => set("agentOperatorId", e.target.value)}
                placeholder="urn:uuid:operator-001"
              />
            </FieldRow>
            <FieldRow label="parties.agents[0].capabilities" htmlFor="agentCapabilities" required>
              <Input
                id="agentCapabilities"
                value={values.agentCapabilities}
                onChange={(e) => set("agentCapabilities", e.target.value)}
                placeholder="summarise, search, translate (comma-separated)"
              />
            </FieldRow>
          </>
        )}
      </FormSection>

      {/* ── Claims Section ── */}
      <FormSection title="Claims">
        <FieldRow label="claims.items[0].id" required>
          <Input value={values.claimId} readOnly className="font-mono text-xs bg-muted" />
        </FieldRow>
        <FieldRow label="claims.items[0].category" required>
          <Select value={values.claimCategory} onValueChange={(v) => set("claimCategory", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {formType === "entity"
                ? ENTITY_CLAIM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))
                : <SelectItem value="data">data</SelectItem>}
            </SelectContent>
          </Select>
        </FieldRow>

        {formType !== "entity" && (
          <>
            <FieldRow label="claims.items[0].resource.uri" htmlFor="resourceUri" required>
              <Input
                id="resourceUri"
                value={values.resourceUri}
                onChange={(e) => set("resourceUri", e.target.value)}
                placeholder="https://storage.example.com/datasets/abc"
              />
            </FieldRow>
            <FieldRow label="claims.items[0].constraints.allowed_actions" required>
              <div className="flex flex-wrap gap-3">
                {ALLOWED_ACTIONS_OPTIONS.map((action) => (
                  <label key={action} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <Checkbox
                      checked={values.allowedActions.includes(action)}
                      onCheckedChange={() => toggleAction(action)}
                    />
                    {action}
                  </label>
                ))}
              </div>
            </FieldRow>
            <FieldRow label="claims.items[0].constraints.purpose[0].code" htmlFor="purposeCode" required>
              <Input
                id="purposeCode"
                value={values.purposeCode}
                onChange={(e) => set("purposeCode", e.target.value)}
                placeholder="e.g. analytics, personalisation"
              />
            </FieldRow>
          </>
        )}
      </FormSection>

      {/* ── Policy Section ── */}
      <FormSection title="Policy">
        <FieldRow label="policy.consent.basis" required>
          <Select value={values.consentBasis} onValueChange={(v) => set("consentBasis", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONSENT_BASES.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {formType === "data" && (
          <>
            <FieldRow label="policy.retention.mode" required>
              <Select value={values.retentionMode} onValueChange={(v) => set("retentionMode", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RETENTION_MODES.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="policy.revocation.supported">
              <div className="flex items-center gap-2">
                <Checkbox checked disabled />
                <span className="text-sm text-muted-foreground">Always true (required)</span>
              </div>
            </FieldRow>
          </>
        )}

        {formType === "use" && (
          <>
            <FieldRow label="policy.consent.grants[0].to.id" htmlFor="grantToId" required>
              <Input
                id="grantToId"
                value={values.grantToId}
                onChange={(e) => set("grantToId", e.target.value)}
                placeholder="urn:uuid:agent-001"
              />
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label="policy.consent.grants[0].effective.from" htmlFor="grantFrom" required>
                <Input
                  id="grantFrom"
                  type="datetime-local"
                  value={values.grantEffectiveFrom}
                  onChange={(e) => set("grantEffectiveFrom", e.target.value)}
                />
              </FieldRow>
              <FieldRow label="policy.consent.grants[0].effective.to" htmlFor="grantTo" required>
                <Input
                  id="grantTo"
                  type="datetime-local"
                  value={values.grantEffectiveTo}
                  onChange={(e) => set("grantEffectiveTo", e.target.value)}
                />
              </FieldRow>
            </div>
          </>
        )}
      </FormSection>

      {/* ── Lifecycle Section ── */}
      <FormSection title="Lifecycle">
        <FieldRow label="lifecycle.status" required>
          <Select value={values.lifecycleStatus} onValueChange={(v) => set("lifecycleStatus", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIFECYCLE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </FormSection>

      {/* ── Errors ── */}
      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-destructive">{err}</p>
          ))}
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? "Processing…" : (submitLabel || "Create CARD Instance")}
      </Button>
    </form>
  );
}
