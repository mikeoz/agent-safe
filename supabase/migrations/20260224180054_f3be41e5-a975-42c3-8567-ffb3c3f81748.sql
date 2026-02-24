CREATE POLICY "Members can view own audit events"
ON public.audit_log
FOR SELECT
USING (
  actor_id = auth.uid()
  OR lifecycle_context->>'issuer_id' = auth.uid()::text
  OR lifecycle_context->>'recipient_member_id' = auth.uid()::text
  OR (actor_id IS NULL AND lifecycle_context->>'issuer_id' IS NOT NULL 
      AND lifecycle_context->>'issuer_id' = auth.uid()::text)
);