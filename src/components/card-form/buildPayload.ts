import { CardFormValues } from "./types";

export function buildPayload(values: CardFormValues, formType: string): object {
  const payload: any = {
    card: {
      id: values.cardId,
      type: values.cardType,
      title: values.cardTitle,
    },
    parties: {
      subject: {
        id: values.subjectId,
        kind: values.subjectKind,
        ...(formType === "entity" ? { display_name: values.subjectDisplayName } : {}),
      },
    },
    claims: {
      items: [buildClaim(values, formType)],
    },
    policy: buildPolicy(values, formType),
    lifecycle: {
      status: values.lifecycleStatus,
    },
  };

  // parties.holder (entity, data)
  if (formType === "entity" || formType === "data") {
    payload.parties.holder = {
      id: values.holderId,
      kind: values.holderKind,
    };
  }

  // parties.recipients (data)
  if (formType === "data") {
    payload.parties.recipients = [
      { id: values.recipientId, kind: values.recipientKind },
    ];
  }

  // parties.agents (use)
  if (formType === "use") {
    const caps = values.agentCapabilities
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    payload.parties.agents = [
      {
        id: values.agentId,
        kind: "agent",
        operator: { id: values.agentOperatorId },
        capabilities: caps,
      },
    ];
  }

  return payload;
}

function buildClaim(values: CardFormValues, formType: string): object {
  const claim: any = {
    id: values.claimId,
    category: values.claimCategory,
  };

  if (formType === "data" || formType === "use") {
    claim.resource = { uri: values.resourceUri };
    if (values.resourceStorage) {
      claim.resource.storage = values.resourceStorage;
    }
    claim.constraints = {
      allowed_actions: values.allowedActions,
      purpose: [{ code: values.purposeCode }],
    };
  }

  return claim;
}

function buildPolicy(values: CardFormValues, formType: string): object {
  const policy: any = {
    consent: { basis: values.consentBasis },
  };

  if (formType === "data") {
    policy.retention = { mode: values.retentionMode };
    policy.revocation = { supported: true };
  }

  if (formType === "use") {
    policy.consent.grants = [
      {
        to: { id: values.grantToId },
        effective: {
          from: values.grantEffectiveFrom,
          to: values.grantEffectiveTo,
        },
      },
    ];
    policy.retention = { mode: "none" };
    policy.prohibitions = ["no_retention", "no_training", "no_onward_sharing"];
  }

  return policy;
}
