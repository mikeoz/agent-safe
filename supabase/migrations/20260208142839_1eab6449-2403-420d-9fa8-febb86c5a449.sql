
CREATE OR REPLACE FUNCTION public.get_audit_trail(p_entity_type text, p_entity_id uuid)
 RETURNS TABLE(id uuid, actor_id uuid, action text, entity_type text, entity_id uuid, lifecycle_context jsonb, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT al.id, al.actor_id, al.action, al.entity_type, al.entity_id, al.lifecycle_context, al.created_at
  FROM public.audit_log al
  WHERE al.entity_type = p_entity_type
    AND al.entity_id = p_entity_id
    AND (
      al.actor_id = auth.uid()
      OR al.lifecycle_context->>'issuer_id' = auth.uid()::text
      OR al.lifecycle_context->>'recipient_member_id' = auth.uid()::text
      OR (al.actor_id IS NULL AND al.entity_type = 'card_form' AND al.action = 'form_registered')
    )
  ORDER BY al.created_at ASC;
$function$;
