-- ============================================================================
-- Opn.li Agent Safe — Migration 002: RLS Policies
-- Row Level Security policies for member-scoped data isolation.
-- ============================================================================

-- ── card_forms: read-only access to registered forms ────────────────────────

CREATE POLICY "Authenticated users can view registered forms"
  ON public.card_forms
  FOR SELECT
  TO authenticated
  USING (status = 'registered'::card_form_status);

-- ── card_instances: member isolation ────────────────────────────────────────

CREATE POLICY "Members can view own instances"
  ON public.card_instances
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "Members can create own instances"
  ON public.card_instances
  FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- ── card_issuances: issuer + recipient access ───────────────────────────────

CREATE POLICY "Parties can view their issuances"
  ON public.card_issuances
  FOR SELECT
  TO authenticated
  USING (issuer_id = auth.uid() OR recipient_member_id = auth.uid());

CREATE POLICY "Issuer can create issuances"
  ON public.card_issuances
  FOR INSERT
  TO authenticated
  WITH CHECK (issuer_id = auth.uid());

CREATE POLICY "Recipient can update issuance status"
  ON public.card_issuances
  FOR UPDATE
  TO authenticated
  USING (recipient_member_id = auth.uid());

-- ── card_deliveries: issuer + recipient access ──────────────────────────────

CREATE POLICY "Issuers can view deliveries for own issuances"
  ON public.card_deliveries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM card_issuances ci
      WHERE ci.id = card_deliveries.issuance_id
        AND ci.issuer_id = auth.uid()
    )
  );

CREATE POLICY "Recipients can view own deliveries"
  ON public.card_deliveries
  FOR SELECT
  TO authenticated
  USING (recipient_member_id = auth.uid());

CREATE POLICY "Authenticated users can insert deliveries"
  ON public.card_deliveries
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Recipients can update own deliveries"
  ON public.card_deliveries
  FOR UPDATE
  TO authenticated
  USING (recipient_member_id = auth.uid());

-- ── audit_log: INSERT-only + scoped SELECT ──────────────────────────────────
-- INSERT: actors can only insert entries attributed to themselves.
-- SELECT: members can view entries where they are the actor, issuer,
--         or recipient (via lifecycle_context fields).

CREATE POLICY "Actors can insert audit entries"
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Members can view own audit events"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR (lifecycle_context->>'issuer_id' = auth.uid()::text)
    OR (lifecycle_context->>'recipient_member_id' = auth.uid()::text)
    OR (
      actor_id IS NULL
      AND (lifecycle_context->>'issuer_id') IS NOT NULL
      AND (lifecycle_context->>'issuer_id' = auth.uid()::text)
    )
  );
