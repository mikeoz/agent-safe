-- ============================================================================
-- Opn.li Agent Safe — Migration 006: Verification Endpoint RPC
-- The verify_agent_trust function powers the Verification Endpoint.
-- Called by the Edge Function at /functions/v1/verify-card.
--
-- Two overloads:
--   verify_agent_trust(p_agent_id text, p_card_ref text)  — primary
--   verify_agent_trust(params jsonb)                       — JSON wrapper
-- ============================================================================

-- ── Primary: verify_agent_trust(text, text) ─────────────────────────────────
-- Given an agent_id (the stable URN from the Entity CARD), returns a
-- complete trust profile: entity status, active use cards, scope summary,
-- and prohibitions. Optionally filters to a specific card_ref.

CREATE OR REPLACE FUNCTION public.verify_agent_trust(
  p_agent_id text,
  p_card_ref text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_agent_entity record;
  v_entity_status text;
  v_active_use_cards jsonb;
  v_scope_summary jsonb;
  v_prohibitions jsonb;
BEGIN
  -- Step 1: Find the agent's Entity CARD
  SELECT
    ci.id as instance_id,
    ci.payload->'card'->>'id' as agent_id,
    ci.payload->'parties'->'operator' as operator,
    ci.is_current,
    ci.superseded_by,
    EXISTS (
      SELECT 1 FROM card_issuances cis
      WHERE cis.instance_id = ci.id AND cis.status = 'revoked'
    ) as is_revoked
  INTO v_agent_entity
  FROM card_instances ci
  INNER JOIN card_forms cf ON cf.id = ci.form_id
  WHERE cf.form_type = 'entity'
    AND ci.payload->'card'->>'id' = p_agent_id
    AND ci.is_current = true
  LIMIT 1;

  -- Determine entity status
  IF v_agent_entity.agent_id IS NULL THEN
    v_entity_status := 'not_found';
  ELSIF v_agent_entity.is_revoked THEN
    v_entity_status := 'revoked';
  ELSIF v_agent_entity.superseded_by IS NOT NULL THEN
    v_entity_status := 'superseded';
  ELSE
    v_entity_status := 'active';
  END IF;

  -- Step 2: Find active USE CARDs for this agent
  SELECT jsonb_agg(
    jsonb_build_object(
      'card_id', ci.payload->'card'->>'id',
      'title', ci.payload->'card'->>'title',
      'purpose', ci.payload->'claims'->'items'->0->'constraints'->'purpose',
      'scope', jsonb_build_object(
        'data_uris', (
          SELECT jsonb_agg(claim->'resource'->>'uri')
          FROM jsonb_array_elements(ci.payload->'claims'->'items') AS claim
          WHERE claim->'resource'->>'uri' IS NOT NULL
        ),
        'allowed_actions', ci.payload->'claims'->'items'->0->'constraints'->'allowed_actions'
      ),
      'issuance_status', cis.status,
      'issued_at', cis.issued_at,
      'effective_until', ci.payload->'policy'->'consent'->'grants'->0->'effective'->>'to'
    )
  )
  INTO v_active_use_cards
  FROM card_instances ci
  INNER JOIN card_forms cf ON cf.id = ci.form_id
  INNER JOIN card_issuances cis ON cis.instance_id = ci.id
  WHERE cf.form_type = 'use'
    AND ci.is_current = true
    AND cis.status IN ('issued', 'accepted')
    AND ci.payload->'parties'->'agents' @> jsonb_build_array(
      jsonb_build_object('id', p_agent_id)
    )
    AND (p_card_ref IS NULL OR ci.payload->'card'->>'id' = p_card_ref);

  v_active_use_cards := COALESCE(v_active_use_cards, '[]'::jsonb);

  -- Step 3: Aggregate scope summary
  WITH use_card_data AS (
    SELECT
      ci.id,
      claim->'resource'->>'uri' as data_uri,
      action.value::text as allowed_action
    FROM card_instances ci
    INNER JOIN card_forms cf ON cf.id = ci.form_id
    INNER JOIN card_issuances cis ON cis.instance_id = ci.id,
    jsonb_array_elements(ci.payload->'claims'->'items') as claim,
    jsonb_array_elements_text(claim->'constraints'->'allowed_actions') as action
    WHERE cf.form_type = 'use'
      AND ci.is_current = true
      AND cis.status IN ('issued', 'accepted')
      AND ci.payload->'parties'->'agents' @> jsonb_build_array(
        jsonb_build_object('id', p_agent_id)
      )
      AND (p_card_ref IS NULL OR ci.payload->'card'->>'id' = p_card_ref)
      AND claim->'resource'->>'uri' IS NOT NULL
  )
  SELECT jsonb_build_object(
    'total_authorizations', COUNT(DISTINCT id),
    'data_sources', COALESCE(jsonb_agg(DISTINCT data_uri) FILTER (WHERE data_uri IS NOT NULL), '[]'::jsonb),
    'allowed_actions', COALESCE(jsonb_agg(DISTINCT allowed_action) FILTER (WHERE allowed_action IS NOT NULL), '[]'::jsonb)
  )
  INTO v_scope_summary
  FROM use_card_data;

  v_scope_summary := COALESCE(v_scope_summary, jsonb_build_object(
    'total_authorizations', 0,
    'data_sources', '[]'::jsonb,
    'allowed_actions', '[]'::jsonb
  ));

  -- Step 4: Aggregate prohibitions
  SELECT COALESCE(jsonb_agg(DISTINCT prohibition), '[]'::jsonb)
  INTO v_prohibitions
  FROM card_instances ci
  INNER JOIN card_forms cf ON cf.id = ci.form_id
  INNER JOIN card_issuances cis ON cis.instance_id = ci.id,
  jsonb_array_elements(ci.payload->'policy'->'prohibitions') as prohibition
  WHERE cf.form_type = 'use'
    AND ci.is_current = true
    AND cis.status IN ('issued', 'accepted')
    AND ci.payload->'parties'->'agents' @> jsonb_build_array(
      jsonb_build_object('id', p_agent_id)
    )
    AND (p_card_ref IS NULL OR ci.payload->'card'->>'id' = p_card_ref)
    AND ci.payload->'policy'->'prohibitions' IS NOT NULL;

  -- Step 5: Build final response
  v_result := jsonb_build_object(
    'agent_id', p_agent_id,
    'entity_status', v_entity_status,
    'operator', v_agent_entity.operator,
    'active_use_cards', v_active_use_cards,
    'scope_summary', v_scope_summary,
    'prohibitions', v_prohibitions,
    'verified_at', now()
  );

  IF p_card_ref IS NOT NULL THEN
    v_result := v_result || jsonb_build_object('card_ref', p_card_ref);
  END IF;

  IF v_entity_status = 'not_found' THEN
    v_result := v_result || jsonb_build_object(
      'message', 'No Entity CARD found for agent_id: ' || p_agent_id
    );
  ELSIF v_entity_status = 'revoked' THEN
    v_result := v_result || jsonb_build_object(
      'message', 'Agent Entity CARD has been revoked. No active authorizations.'
    );
  ELSIF v_entity_status = 'superseded' THEN
    v_result := v_result || jsonb_build_object(
      'message', 'Agent Entity CARD has been superseded by a newer version.'
    );
  END IF;

  IF p_card_ref IS NOT NULL AND jsonb_array_length(v_active_use_cards) = 0 THEN
    v_result := v_result || jsonb_build_object(
      'message', 'No active USE CARD found with card_ref: ' || p_card_ref
    );
  END IF;

  RETURN v_result;
END;
$function$;

-- ── JSON wrapper overload ───────────────────────────────────────────────────
-- Accepts a JSONB object with p_agent_id and p_card_ref fields.
-- Used by the Edge Function for cleaner request handling.

CREATE OR REPLACE FUNCTION public.verify_agent_trust(params jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.verify_agent_trust(
    params->>'p_agent_id',
    params->>'p_card_ref'
  );
END;
$function$;
