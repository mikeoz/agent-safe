
-- Enable dblink for autonomous transactions
CREATE EXTENSION IF NOT EXISTS dblink SCHEMA extensions;

-- Helper: insert audit log via a separate connection (survives caller rollback)
CREATE OR REPLACE FUNCTION public.log_blocked_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor_id uuid,
  p_lifecycle_context jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM extensions.dblink_exec(
    'dbname=' || current_database(),
    format(
      'INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context) VALUES (%L, %L, %L, %s, %L::jsonb)',
      p_action,
      p_entity_type,
      p_entity_id::text,
      COALESCE(quote_literal(p_actor_id::text), 'NULL'),
      p_lifecycle_context::text
    )
  );
END;
$$;

-- Rebuild create_card_instance: blocked paths use non-rollbackable audit, then raise
CREATE OR REPLACE FUNCTION public.create_card_instance(p_form_id uuid, p_payload jsonb)
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
    -- Write audit via autonomous transaction (survives the RAISE below)
    PERFORM public.log_blocked_audit(
      'instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
      jsonb_build_object('reason', 'form_not_found'));
    RAISE EXCEPTION 'Form does not exist: %', p_form_id;
  END IF;

  IF v_form_status != 'registered' THEN
    PERFORM public.log_blocked_audit(
      'instance_create_blocked_unregistered_form', 'card_form', p_form_id, auth.uid(),
      jsonb_build_object('reason', 'form_not_registered', 'form_status', v_form_status::text));
    RAISE EXCEPTION 'Cannot create instance from unregistered form (status: %)', v_form_status;
  END IF;

  -- Happy path: normal transactional audit (rolls back if instance insert fails, which is correct)
  INSERT INTO public.card_instances (form_id, member_id, payload)
  VALUES (p_form_id, auth.uid(), p_payload)
  RETURNING id INTO v_instance_id;

  INSERT INTO public.audit_log (action, entity_type, entity_id, actor_id, lifecycle_context)
  VALUES ('instance_created', 'card_instance', v_instance_id, auth.uid(),
          jsonb_build_object('form_id', p_form_id::text));

  RETURN v_instance_id;
END;
$$;
