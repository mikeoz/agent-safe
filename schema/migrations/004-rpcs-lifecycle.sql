-- ============================================================================
-- Opn.li Agent Safe — Migration 004: Lifecycle RPCs (Part 2)
-- SECURITY DEFINER functions for: resolve, revoke, supersede, audit queries.
-- ============================================================================

-- ── resolve_card_issuance ───────────────────────────────────────────────────
-- Recipient accepts or rejects an issued CARD. Updates issuance status,
-- delivery status, and creates audit entry.

CREATE OR REPLACE FUNCTION public.resolve_card_issuance(
  p_issuance_id uuid,
  p_resolution  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_issuance record;
  v_action   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required';
  END IF;

  SELECT * INTO v_issuance
  FROM   public.card_issuances
  WHERE  id = p_issuance_id;

  IF v_issuance IS NULL THEN
    RAISE EXCEPTION 'Issuance not found: %', p_issuance_id;
  END IF;

  IF v_issuance.recipient_member_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to resolve this issuance';
  END IF;

  IF v_issuance.status != 'issued' THEN
    RAISE EXCEPTION 'Issuance is not in issued status (current: %)', v_issuance.status;
  END IF;

  IF p_resolution NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid resolution: % (must be accepted or rejected)', p_resolution;
  END IF;

  UPDATE public.card_issuances
  SET    status      = p_resolution::public.issuance_status,
         resolved_at = now()
  WHERE  id          = p_issuance_id;

  UPDATE public.card_deliveries
  SET    status     = p_resolution,
         updated_at = now()
  WHERE  issuance_id = p_issuance_id;

  v_action := CASE WHEN p_resolution = 'accepted' THEN 'card_accepted' ELSE 'card_rejected' END;

  INSERT INTO public.audit_log
    (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES (
    v_action, 'card_issuance', p_issuance_id, auth.uid(),
    jsonb_build_object(
      'instance_id',          v_issuance.instance_id::text,
      'issuer_id',            v_issuance.issuer_id::text,
      'recipient_member_id',  v_issuance.recipient_member_id::text
    )
  );
END;
$function$;

-- ── revoke_card_issuance ────────────────────────────────────────────────────
-- Issuer revokes an issued or accepted CARD. This is the "Close the door"
-- action in the consumer UI.

CREATE OR REPLACE FUNCTION public.revoke_card_issuance(p_issuance_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_issuance record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required';
  END IF;

  SELECT * INTO v_issuance
  FROM public.card_issuances
  WHERE id = p_issuance_id;

  IF v_issuance IS NULL THEN
    RAISE EXCEPTION 'Issuance not found: %', p_issuance_id;
  END IF;

  IF v_issuance.issuer_id != auth.uid() THEN
    RAISE EXCEPTION 'NOT_ISSUER: Not authorized to revoke this issuance';
  END IF;

  IF v_issuance.status NOT IN ('issued', 'accepted') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Cannot revoke issuance with status %', v_issuance.status;
  END IF;

  UPDATE public.card_issuances
  SET status = 'revoked'::public.issuance_status
  WHERE id = p_issuance_id;

  UPDATE public.card_deliveries
  SET
    status = 'revoked',
    updated_at = now()
  WHERE issuance_id = p_issuance_id;

  INSERT INTO public.audit_log
    (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES (
    'card_revoked',
    'card_issuance',
    p_issuance_id,
    auth.uid(),
    jsonb_build_object(
      'instance_id',         v_issuance.instance_id::text,
      'issuer_id',           v_issuance.issuer_id::text,
      'recipient_member_id', v_issuance.recipient_member_id::text,
      'revoked_at',          now()::text
    )
  );
END;
$function$;

-- ── supersede_card_instance ─────────────────────────────────────────────────
-- Replaces a current CARD instance with a new version. The old instance
-- is marked superseded (is_current = false) and linked to the new one.
-- This preserves the full version history in the audit trail.

CREATE OR REPLACE FUNCTION public.supersede_card_instance(
  p_old_instance_id uuid,
  p_new_payload     jsonb
)
RETURNS TABLE(new_instance_id uuid, error_code text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_new_instance_id uuid;
  v_old_instance    record;
  v_form_id         uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, 'AUTH_REQUIRED'::text, 'Authentication required'::text;
    RETURN;
  END IF;

  SELECT * INTO v_old_instance
  FROM public.card_instances
  WHERE id = p_old_instance_id;

  IF v_old_instance IS NULL THEN
    RETURN QUERY SELECT
      NULL::uuid,
      'INSTANCE_NOT_FOUND'::text,
      ('Instance does not exist: ' || p_old_instance_id::text)::text;
    RETURN;
  END IF;

  IF v_old_instance.member_id != auth.uid() THEN
    RETURN QUERY SELECT
      NULL::uuid,
      'NOT_OWNER'::text,
      'Not authorized to supersede this instance'::text;
    RETURN;
  END IF;

  IF v_old_instance.is_current = false THEN
    RETURN QUERY SELECT
      NULL::uuid,
      'ALREADY_SUPERSEDED'::text,
      'Instance is not current (already superseded)'::text;
    RETURN;
  END IF;

  v_form_id := v_old_instance.form_id;

  INSERT INTO public.card_instances (form_id, member_id, payload)
  VALUES (v_form_id, auth.uid(), p_new_payload)
  RETURNING id INTO v_new_instance_id;

  UPDATE public.card_instances
  SET
    superseded_by = v_new_instance_id,
    superseded_at = now(),
    is_current    = false
  WHERE id = p_old_instance_id;

  INSERT INTO public.audit_log
    (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES (
    'card_superseded',
    'card_instance',
    p_old_instance_id,
    auth.uid(),
    jsonb_build_object(
      'old_instance_id', p_old_instance_id::text,
      'new_instance_id', v_new_instance_id::text,
      'form_id',         v_form_id::text,
      'superseded_at',   now()::text
    )
  );

  RETURN QUERY SELECT v_new_instance_id, NULL::text, NULL::text;
END;
$function$;

-- ── get_my_recent_audit ─────────────────────────────────────────────────────
-- Returns the authenticated user's most recent audit entries.

CREATE OR REPLACE FUNCTION public.get_my_recent_audit(p_limit integer DEFAULT 20)
RETURNS TABLE(
  id               uuid,
  actor_id         uuid,
  action           text,
  entity_type      text,
  entity_id        uuid,
  lifecycle_context jsonb,
  created_at       timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT al.id, al.actor_id, al.action, al.entity_type,
         al.entity_id, al.lifecycle_context, al.created_at
  FROM   public.audit_log al
  WHERE  al.actor_id = auth.uid()
  ORDER BY al.created_at DESC
  LIMIT p_limit;
$function$;

-- ── get_audit_trail ─────────────────────────────────────────────────────────
-- Returns the audit trail for a specific entity, scoped to the
-- authenticated user's visibility.

CREATE OR REPLACE FUNCTION public.get_audit_trail(
  p_entity_type text,
  p_entity_id   uuid
)
RETURNS TABLE(
  id               uuid,
  actor_id         uuid,
  action           text,
  entity_type      text,
  entity_id        uuid,
  lifecycle_context jsonb,
  created_at       timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT al.id, al.actor_id, al.action, al.entity_type,
         al.entity_id, al.lifecycle_context, al.created_at
  FROM   public.audit_log al
  WHERE  al.entity_type = p_entity_type
    AND  al.entity_id   = p_entity_id
    AND  (
           al.actor_id = auth.uid()
        OR al.lifecycle_context->>'issuer_id'           = auth.uid()::text
        OR al.lifecycle_context->>'recipient_member_id' = auth.uid()::text
        OR (al.actor_id IS NULL
            AND al.entity_type = 'card_form'
            AND al.action      = 'form_registered')
         )
  ORDER BY al.created_at ASC;
$function$;

-- ── get_card_lineage ────────────────────────────────────────────────────────
-- Walks the supersession chain in both directions from a given instance,
-- returning the full version history of a CARD.

CREATE OR REPLACE FUNCTION public.get_card_lineage(p_instance_id uuid)
RETURNS TABLE(
  instance_id    uuid,
  form_id        uuid,
  payload        jsonb,
  is_current     boolean,
  superseded_by  uuid,
  superseded_at  timestamptz,
  created_at     timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE lineage AS (
    SELECT
      ci.id, ci.form_id, ci.payload, ci.is_current,
      ci.superseded_by, ci.superseded_at, ci.created_at, ci.member_id
    FROM public.card_instances ci
    WHERE ci.id = p_instance_id
    UNION ALL
    SELECT
      next.id, next.form_id, next.payload, next.is_current,
      next.superseded_by, next.superseded_at, next.created_at, next.member_id
    FROM public.card_instances next
    INNER JOIN lineage ON lineage.superseded_by = next.id
  ),
  backward AS (
    SELECT
      ci.id, ci.form_id, ci.payload, ci.is_current,
      ci.superseded_by, ci.superseded_at, ci.created_at, ci.member_id
    FROM public.card_instances ci
    WHERE ci.superseded_by = p_instance_id
    UNION ALL
    SELECT
      prev.id, prev.form_id, prev.payload, prev.is_current,
      prev.superseded_by, prev.superseded_at, prev.created_at, prev.member_id
    FROM public.card_instances prev
    INNER JOIN backward ON prev.superseded_by = backward.id
  ),
  combined AS (
    SELECT * FROM lineage
    UNION
    SELECT * FROM backward
  )
  SELECT DISTINCT
    combined.id, combined.form_id, combined.payload, combined.is_current,
    combined.superseded_by, combined.superseded_at, combined.created_at
  FROM combined
  WHERE combined.member_id = auth.uid()
  ORDER BY combined.created_at ASC;
$function$;

-- ── get_issued_card_instance ────────────────────────────────────────────────
-- Returns the CARD instance data for a given issuance, but only if the
-- authenticated user is the recipient and the issuance is active.

CREATE OR REPLACE FUNCTION public.get_issued_card_instance(p_issuance_id uuid)
RETURNS TABLE(
  instance_id uuid,
  form_id     uuid,
  payload     jsonb,
  created_at  timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ci.id, ci.form_id, ci.payload, ci.created_at
  FROM   public.card_instances ci
  JOIN   public.card_issuances cis ON cis.instance_id = ci.id
  WHERE  cis.id = p_issuance_id
    AND  cis.recipient_member_id = auth.uid()
    AND  cis.status IN ('issued', 'accepted');
$function$;
