
-- Drop old issue_card with its original return type
DROP FUNCTION IF EXISTS public.issue_card(uuid, uuid, text);

-- Recreate issue_card returning TABLE(issuance_id, delivery_id)
CREATE OR REPLACE FUNCTION public.issue_card(
  p_instance_id uuid,
  p_recipient_member_id uuid DEFAULT NULL,
  p_invitee_locator text DEFAULT NULL
)
RETURNS TABLE(issuance_id uuid, delivery_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_issuance_id uuid;
  v_delivery_id uuid;
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

  INSERT INTO public.card_deliveries (issuance_id, recipient_member_id, invitee_locator, status)
  VALUES (v_issuance_id, p_recipient_member_id, p_invitee_locator, 'pending')
  RETURNING id INTO v_delivery_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('card_issued', 'card_issuance', v_issuance_id, auth.uid(),
          jsonb_build_object(
            'instance_id', p_instance_id::text,
            'issuer_id', auth.uid()::text,
            'recipient_member_id', p_recipient_member_id::text,
            'invitee_locator', p_invitee_locator,
            'delivery_id', v_delivery_id::text
          ));

  RETURN QUERY SELECT v_issuance_id, v_delivery_id;
END;
$function$;

-- Update resolve to also update delivery
CREATE OR REPLACE FUNCTION public.resolve_card_issuance(p_issuance_id uuid, p_resolution text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  UPDATE public.card_deliveries
  SET status = p_resolution, updated_at = now()
  WHERE issuance_id = p_issuance_id;

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
$function$;
