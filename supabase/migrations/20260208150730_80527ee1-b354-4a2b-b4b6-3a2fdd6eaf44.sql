
-- Drop the old function (returns uuid) so we can change return type
DROP FUNCTION IF EXISTS public.create_card_instance(uuid, jsonb);

-- Recreate with structured return: (instance_id, error_code, error_message)
CREATE OR REPLACE FUNCTION public.create_card_instance(p_form_id uuid, p_payload jsonb)
RETURNS TABLE(instance_id uuid, error_code text, error_message text)
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
    -- Audit row commits with the transaction (no RAISE, no rollback)
    INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
    VALUES ('instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
            jsonb_build_object('reason', 'form_not_found'));
    RETURN QUERY SELECT NULL::uuid, 'FORM_NOT_FOUND'::text,
      ('Form does not exist: ' || p_form_id::text)::text;
    RETURN;
  END IF;

  IF v_form_status != 'registered' THEN
    INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
    VALUES ('instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
            jsonb_build_object('reason', 'form_not_registered', 'form_status', v_form_status::text));
    RETURN QUERY SELECT NULL::uuid, 'FORM_NOT_REGISTERED'::text,
      ('Cannot create instance from unregistered form (status: ' || v_form_status::text || ')')::text;
    RETURN;
  END IF;

  -- Happy path
  INSERT INTO public.card_instances (form_id, member_id, payload)
  VALUES (p_form_id, auth.uid(), p_payload)
  RETURNING id INTO v_instance_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('instance_created', 'card_instance', v_instance_id, auth.uid(),
          jsonb_build_object('form_id', p_form_id::text));

  RETURN QUERY SELECT v_instance_id, NULL::text, NULL::text;
END;
$$;
