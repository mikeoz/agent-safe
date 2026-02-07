
-- Write-path functions for OPN4.001 lifecycle operations
-- All functions are SECURITY DEFINER for atomic operation + audit in single transaction

-- 1. register_card_form: Register a CARD form (system/admin action in Alpha)
CREATE OR REPLACE FUNCTION public.register_card_form(
  p_name text,
  p_form_type public.card_form_type,
  p_schema_definition jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_form_id uuid;
BEGIN
  INSERT INTO public.card_forms (name, form_type, schema_definition, status, registered_at)
  VALUES (p_name, p_form_type, p_schema_definition, 'registered', now())
  RETURNING id INTO v_form_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('form_registered', 'card_form', v_form_id, auth.uid(),
          jsonb_build_object('form_name', p_name, 'form_type', p_form_type::text));

  RETURN v_form_id;
END;
$$;

-- 2. create_card_instance: Member creates instance from registered form
CREATE OR REPLACE FUNCTION public.create_card_instance(
  p_form_id uuid,
  p_payload jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_instance_id uuid;
  v_form_status public.card_form_status;
BEGIN
  SELECT status INTO v_form_status FROM public.card_forms WHERE id = p_form_id;

  IF v_form_status IS NULL THEN
    INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
    VALUES ('instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
            jsonb_build_object('reason', 'form_not_found'));
    RAISE EXCEPTION 'Form does not exist: %', p_form_id;
  END IF;

  IF v_form_status != 'registered' THEN
    INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
    VALUES ('instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
            jsonb_build_object('reason', 'form_not_registered', 'form_status', v_form_status::text));
    RAISE EXCEPTION 'Cannot create instance from unregistered form (status: %)', v_form_status;
  END IF;

  INSERT INTO public.card_instances (form_id, member_id, payload)
  VALUES (p_form_id, auth.uid(), p_payload)
  RETURNING id INTO v_instance_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('instance_created', 'card_instance', v_instance_id, auth.uid(),
          jsonb_build_object('form_id', p_form_id::text));

  RETURN v_instance_id;
END;
$$;

-- 3. issue_card: Member issues an owned instance to another member or invitee
CREATE OR REPLACE FUNCTION public.issue_card(
  p_instance_id uuid,
  p_recipient_member_id uuid DEFAULT NULL,
  p_invitee_locator text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_issuance_id uuid;
  v_owner_id uuid;
BEGIN
  SELECT member_id INTO v_owner_id FROM public.card_instances WHERE id = p_instance_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Instance not found: %', p_instance_id;
  END IF;

  IF v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized to issue this instance';
  END IF;

  IF (p_recipient_member_id IS NOT NULL AND p_invitee_locator IS NOT NULL)
     OR (p_recipient_member_id IS NULL AND p_invitee_locator IS NULL) THEN
    RAISE EXCEPTION 'Exactly one recipient target required';
  END IF;

  INSERT INTO public.card_issuances (instance_id, issuer_id, recipient_member_id, invitee_locator, status)
  VALUES (p_instance_id, auth.uid(), p_recipient_member_id, p_invitee_locator, 'issued')
  RETURNING id INTO v_issuance_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('card_issued', 'card_issuance', v_issuance_id, auth.uid(),
          jsonb_build_object(
            'instance_id', p_instance_id::text,
            'issuer_id', auth.uid()::text,
            'recipient_member_id', p_recipient_member_id::text,
            'invitee_locator', p_invitee_locator
          ));

  RETURN v_issuance_id;
END;
$$;

-- 4. resolve_card_issuance: Recipient accepts or rejects
CREATE OR REPLACE FUNCTION public.resolve_card_issuance(
  p_issuance_id uuid,
  p_resolution text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_issuance record;
  v_action text;
BEGIN
  SELECT * INTO v_issuance FROM public.card_issuances WHERE id = p_issuance_id;

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
  SET status = p_resolution::public.issuance_status, resolved_at = now()
  WHERE id = p_issuance_id;

  IF p_resolution = 'accepted' THEN
    v_action := 'card_accepted';
  ELSE
    v_action := 'card_rejected';
  END IF;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES (v_action, 'card_issuance', p_issuance_id, auth.uid(),
          jsonb_build_object(
            'instance_id', v_issuance.instance_id::text,
            'issuer_id', v_issuance.issuer_id::text,
            'recipient_member_id', v_issuance.recipient_member_id::text
          ));
END;
$$;

-- Restrict all functions to authenticated users only
REVOKE ALL ON FUNCTION public.register_card_form(text, public.card_form_type, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_card_form(text, public.card_form_type, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.create_card_instance(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_card_instance(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.issue_card(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_card(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_card_issuance(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_card_issuance(uuid, text) TO authenticated;
