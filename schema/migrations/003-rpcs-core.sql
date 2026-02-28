-- ============================================================================
-- Opn.li Agent Safe — Migration 003: Core RPCs (Part 1)
-- SECURITY DEFINER functions for card lifecycle: register, create, issue.
-- ============================================================================

-- ── register_card_form ──────────────────────────────────────────────────────
-- Registers a new CARD form type. Creates the form record and logs
-- the registration event to the audit trail.

CREATE OR REPLACE FUNCTION public.register_card_form(
  p_name              text,
  p_form_type         card_form_type,
  p_schema_definition jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_form_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required';
  END IF;

  INSERT INTO public.card_forms (name, form_type, schema_definition, status, registered_at)
  VALUES (p_name, p_form_type, p_schema_definition, 'registered', now())
  RETURNING id INTO v_form_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('form_registered', 'card_form', v_form_id, auth.uid(),
          jsonb_build_object('form_name', p_name, 'form_type', p_form_type::text));

  RETURN v_form_id;
END;
$function$;

-- ── create_card_instance ────────────────────────────────────────────────────
-- Creates a new CARD instance against a registered form. The payload is
-- validated by the enforce_registered_form trigger before insertion.
-- Returns (instance_id, error_code, error_message) — error fields are
-- NULL on success.

CREATE OR REPLACE FUNCTION public.create_card_instance(
  p_form_id uuid,
  p_payload jsonb
)
RETURNS TABLE(instance_id uuid, error_code text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_instance_id   uuid;
    v_sqlerrm       text;
    v_sqlhint       text;
    v_sqldetail     text;
    v_err_code      text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, 'AUTH_REQUIRED'::text, 'Authentication required'::text;
        RETURN;
    END IF;

    INSERT INTO card_instances (form_id, member_id, payload)
    VALUES (p_form_id, auth.uid(), p_payload)
    RETURNING card_instances.id INTO v_instance_id;

    RETURN QUERY SELECT v_instance_id, NULL::text, NULL::text;

EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS
            v_sqlerrm   = MESSAGE_TEXT,
            v_sqlhint   = PG_EXCEPTION_HINT,
            v_sqldetail = PG_EXCEPTION_DETAIL;

        IF v_sqlhint LIKE 'err_code=%' THEN
            v_err_code := substring(v_sqlhint FROM 'err_code=(.*)');
        ELSE
            v_err_code := 'VALIDATION_ERROR';
        END IF;

        IF v_sqldetail IS NOT NULL AND v_sqldetail <> '' THEN
            v_sqlerrm := v_sqlerrm || ' Missing: ' || replace(v_sqldetail, '|', ', ');
        END IF;

        RETURN QUERY SELECT NULL::uuid, v_err_code, v_sqlerrm;
END;
$function$;

-- ── issue_card ──────────────────────────────────────────────────────────────
-- Issues a CARD instance to a recipient. Creates the issuance record,
-- delivery record, and audit entry in a single transaction.
-- Exactly one of recipient_member_id or invitee_locator must be provided.

CREATE OR REPLACE FUNCTION public.issue_card(
  p_instance_id         uuid,
  p_recipient_member_id uuid DEFAULT NULL,
  p_invitee_locator     text DEFAULT NULL
)
RETURNS TABLE(issuance_id uuid, delivery_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_issuance_id uuid;
  v_delivery_id uuid;
  v_owner_id    uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Authentication required';
  END IF;

  SELECT member_id INTO v_owner_id
  FROM   public.card_instances
  WHERE  id = p_instance_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Instance not found: %', p_instance_id;
  END IF;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to issue this instance';
  END IF;

  IF (p_recipient_member_id IS NOT NULL AND p_invitee_locator IS NOT NULL)
  OR (p_recipient_member_id IS NULL     AND p_invitee_locator IS NULL) THEN
    RAISE EXCEPTION 'Exactly one recipient target required';
  END IF;

  INSERT INTO public.card_issuances
    (instance_id, issuer_id, recipient_member_id, invitee_locator, status)
  VALUES
    (p_instance_id, auth.uid(), p_recipient_member_id, p_invitee_locator, 'issued')
  RETURNING id INTO v_issuance_id;

  INSERT INTO public.card_deliveries
    (issuance_id, recipient_member_id, invitee_locator, status)
  VALUES
    (v_issuance_id, p_recipient_member_id, p_invitee_locator, 'pending')
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.audit_log
    (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES (
    'card_issued', 'card_issuance', v_issuance_id, auth.uid(),
    jsonb_build_object(
      'instance_id',          p_instance_id::text,
      'issuer_id',            auth.uid()::text,
      'recipient_member_id',  p_recipient_member_id::text,
      'invitee_locator',      p_invitee_locator,
      'delivery_id',          v_delivery_id::text
    )
  );

  RETURN QUERY SELECT v_issuance_id, v_delivery_id;
END;
$function$;
