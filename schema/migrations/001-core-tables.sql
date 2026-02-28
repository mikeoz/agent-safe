-- ============================================================================
-- Opn.li Agent Safe — Migration 001: Core Tables
-- Creates enum types and the four core tables.
-- Safe to run on a clean Supabase instance.
-- ============================================================================

-- ── Enum Types ──────────────────────────────────────────────────────────────

CREATE TYPE public.card_form_type AS ENUM ('entity', 'data', 'use');
CREATE TYPE public.card_form_status AS ENUM ('draft', 'registered');
CREATE TYPE public.issuance_status AS ENUM ('issued', 'accepted', 'rejected', 'revoked');

-- ── Table: card_forms ───────────────────────────────────────────────────────
-- Registry of CARD form types. Each form defines a category of CARD
-- (entity, data, or use) and a schema_definition that constrains payloads.
-- Form IDs are immutable constants once registered.

CREATE TABLE public.card_forms (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  form_type         card_form_type NOT NULL,
  name              text        NOT NULL,
  schema_definition jsonb       NOT NULL,
  status            card_form_status NOT NULL DEFAULT 'draft'::card_form_status,
  registered_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── Table: card_instances ───────────────────────────────────────────────────
-- Individual CARD instances created by members. Each instance references a
-- registered form and contains a freeform (but validated) JSONB payload
-- conforming to the CARD v0.1 schema.

CREATE TABLE public.card_instances (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  form_id         uuid        NOT NULL REFERENCES public.card_forms(id),
  member_id       uuid        NOT NULL,
  payload         jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  superseded_by   uuid,
  superseded_at   timestamptz,
  is_current      boolean     NOT NULL DEFAULT true,
  PRIMARY KEY (id)
);

CREATE INDEX idx_card_instances_member_id ON public.card_instances(member_id);
CREATE INDEX idx_card_instances_form_id ON public.card_instances(form_id);

-- ── Table: card_issuances ───────────────────────────────────────────────────
-- Tracks the issuance of a CARD instance from an issuer (the card owner)
-- to a recipient. Status lifecycle: issued → accepted/rejected/revoked.

CREATE TABLE public.card_issuances (
  id                    uuid            NOT NULL DEFAULT gen_random_uuid(),
  instance_id           uuid            NOT NULL REFERENCES public.card_instances(id),
  issuer_id             uuid            NOT NULL,
  recipient_member_id   uuid,
  invitee_locator       text,
  status                issuance_status NOT NULL DEFAULT 'issued'::issuance_status,
  issued_at             timestamptz     NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  PRIMARY KEY (id)
);

CREATE INDEX idx_card_issuances_instance_id ON public.card_issuances(instance_id);
CREATE INDEX idx_card_issuances_issuer_id ON public.card_issuances(issuer_id);
CREATE INDEX idx_card_issuances_recipient ON public.card_issuances(recipient_member_id);

-- ── Table: card_deliveries ──────────────────────────────────────────────────
-- Delivery tracking for issuances. One delivery per issuance.

CREATE TABLE public.card_deliveries (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  issuance_id           uuid        NOT NULL REFERENCES public.card_issuances(id),
  recipient_member_id   uuid,
  invitee_locator       text,
  status                text        NOT NULL DEFAULT 'pending',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- ── Table: audit_log ────────────────────────────────────────────────────────
-- Append-only audit trail. INSERT-only by design — no UPDATE or DELETE
-- permissions are ever granted. This is an architectural invariant.

CREATE TABLE public.audit_log (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  actor_id          uuid,
  action            text        NOT NULL,
  entity_type       text        NOT NULL,
  entity_id         uuid        NOT NULL,
  lifecycle_context jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX idx_audit_log_actor_id ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);

-- ── Enable Row Level Security ───────────────────────────────────────────────

ALTER TABLE public.card_forms      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_instances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_issuances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log       ENABLE ROW LEVEL SECURITY;

-- ── Trigger: auto-update updated_at on card_deliveries ──────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_card_deliveries_updated_at
  BEFORE UPDATE ON public.card_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
