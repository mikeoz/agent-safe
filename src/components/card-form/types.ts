export interface CardFormRecord {
  id: string;
  name: string;
  form_type: "entity" | "data" | "use";
  schema_definition: any;
}

export interface CardFormValues {
  // card section
  cardId: string;
  cardType: string;
  cardTitle: string;

  // parties.subject
  subjectId: string;
  subjectKind: string;
  subjectDisplayName: string;

  // parties.holder (entity/data)
  holderId: string;
  holderKind: string;

  // parties.recipients (data only)
  recipientId: string;
  recipientKind: string;

  // parties.agents (use only)
  agentId: string;
  agentOperatorId: string;
  agentCapabilities: string;

  // claims
  claimId: string;
  claimCategory: string;

  // claims - data/use
  resourceUri: string;
  resourceStorage: string;
  allowedActions: string[];
  purposeCode: string;

  // policy
  consentBasis: string;

  // policy - data
  retentionMode: string;

  // policy - use
  grantToId: string;
  grantEffectiveFrom: string;
  grantEffectiveTo: string;

  // lifecycle
  lifecycleStatus: string;
}

export const PARTY_KINDS = ["person", "org", "service", "agent"] as const;
export const CONSENT_BASES = ["explicit", "contract", "legal_obligation"] as const;
export const LIFECYCLE_STATUSES = ["draft", "active"] as const;
export const RETENTION_MODES = ["none", "time_bound", "event_bound", "indefinite"] as const;
export const ALLOWED_ACTIONS_OPTIONS = ["read", "write", "copy", "derive", "share"] as const;
export const ENTITY_CLAIM_CATEGORIES = ["attestation", "relationship"] as const;

export const CARD_TYPE_URLS: Record<string, string> = {
  entity: "https://opn.li/types/card/entity",
  data: "https://opn.li/types/card/data",
  use: "https://opn.li/types/card/use",
};
