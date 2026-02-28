-- ============================================================================
-- Opn.li Agent Safe — Migration 005: Payload Validation
-- Enforces that every card_instance payload conforms to its form's
-- schema_definition. Runs as a BEFORE INSERT trigger.
-- ============================================================================

-- ── Helper: dot-path existence check ────────────────────────────────────────
-- Navigates a JSONB object using dot notation (e.g. "card.type") and
-- returns true if the value exists and is non-null. Empty arrays return false
-- because an empty claims list provides no trust basis.

CREATE OR REPLACE FUNCTION public.opn_jsonb_path_exists(
  data     jsonb,
  dot_path text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
    parts   text[];
    current jsonb;
    part    text;
BEGIN
    parts   := string_to_array(dot_path, '.');
    current := data;

    FOREACH part IN ARRAY parts LOOP
        IF jsonb_typeof(current) <> 'object' THEN
            RETURN false;
        END IF;

        current := current -> part;

        IF current IS NULL OR current = 'null'::jsonb THEN
            RETURN false;
        END IF;
    END LOOP;

    -- Empty arrays count as absent (no items = no trust basis)
    IF jsonb_typeof(current) = 'array' AND jsonb_array_length(current) = 0 THEN
        RETURN false;
    END IF;

    RETURN true;
END;
$function$;

-- ── Payload validation function ─────────────────────────────────────────────
-- Called by the enforce_registered_form trigger. Validates:
-- 1. card.type matches the form's allowed_types list
-- 2. All required_paths are present and non-null in the payload

CREATE OR REPLACE FUNCTION public.opn_validate_card_payload(
  p_form    card_forms,
  p_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
    required_paths  jsonb;
    path_item       jsonb;
    dot_path        text;
    missing_paths   text[] := '{}';
    allowed_types   jsonb;
    payload_type    text;
    type_item       jsonb;
    type_allowed    boolean := false;
BEGIN

    -- Guard: schema_definition must be present
    IF p_form.schema_definition IS NULL
       OR p_form.schema_definition = '{}'::jsonb
       OR p_form.schema_definition = 'null'::jsonb THEN
        RETURN;
    END IF;

    -- 1. Validate card.type matches the form's allowed_types
    allowed_types := p_form.schema_definition -> 'allowed_types';
    payload_type  := p_payload #>> '{card,type}';

    IF allowed_types IS NOT NULL
       AND jsonb_typeof(allowed_types) = 'array'
       AND jsonb_array_length(allowed_types) > 0 THEN

        IF payload_type IS NULL THEN
            missing_paths := array_append(missing_paths, 'card.type');
        ELSE
            FOR type_item IN SELECT jsonb_array_elements(allowed_types) LOOP
                IF type_item #>> '{}' = payload_type THEN
                    type_allowed := true;
                    EXIT;
                END IF;
            END LOOP;

            IF NOT type_allowed THEN
                RAISE EXCEPTION
                    'CARD payload type mismatch. Form % (%) expects card.type in %, got %.',
                    p_form.name, p_form.form_type,
                    allowed_types::text, payload_type
                USING
                    HINT    = 'err_code=PAYLOAD_TYPE_MISMATCH',
                    DETAIL  = 'card.type=' || coalesce(payload_type, 'null');
            END IF;
        END IF;
    END IF;

    -- 2. Validate all required_paths are present and non-null
    required_paths := p_form.schema_definition -> 'required_paths';

    IF required_paths IS NOT NULL
       AND jsonb_typeof(required_paths) = 'array' THEN

        FOR path_item IN SELECT jsonb_array_elements(required_paths) LOOP
            dot_path := path_item #>> '{}';

            IF NOT opn_jsonb_path_exists(p_payload, dot_path) THEN
                missing_paths := array_append(missing_paths, dot_path);
            END IF;
        END LOOP;

    END IF;

    -- 3. Raise if any paths are missing
    IF array_length(missing_paths, 1) > 0 THEN
        RAISE EXCEPTION
            'CARD payload is missing % required field(s) for form % (%). '
            'A CARD instance cannot be created without passing explicit payload validation. '
            'Review OPN4 Master Specification Section 3 for required fields per CARD type.',
            array_length(missing_paths, 1),
            p_form.name,
            p_form.form_type
        USING
            HINT   = 'err_code=PAYLOAD_MISSING_REQUIRED_FIELDS',
            DETAIL = array_to_string(missing_paths, '|');
    END IF;

END;
$function$;

-- ── Trigger: enforce_registered_form ────────────────────────────────────────
-- BEFORE INSERT trigger on card_instances. Ensures:
-- 1. The referenced form exists and is in 'registered' status
-- 2. The payload passes the form's validation rules

CREATE OR REPLACE FUNCTION public.enforce_registered_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_form  card_forms;
BEGIN
    SELECT * INTO v_form
    FROM   card_forms
    WHERE  id = NEW.form_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'CARD form % does not exist. Registration is required before instance creation.',
            NEW.form_id
        USING HINT = 'err_code=FORM_NOT_FOUND';
    END IF;

    IF v_form.status <> 'registered' THEN
        RAISE EXCEPTION
            'CARD form % (%) is in status %. Only registered forms may produce instances. '
            'Registration establishes eligibility — it is not advisory.',
            v_form.name, v_form.id, v_form.status
        USING HINT = 'err_code=FORM_NOT_REGISTERED';
    END IF;

    PERFORM opn_validate_card_payload(v_form, NEW.payload);

    RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_enforce_registered_form
  BEFORE INSERT ON public.card_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_registered_form();
