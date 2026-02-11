# OPN4 — Alpha Decisions Log (v1.0)

This document records **intentional Alpha decisions** for OPN4 (Trust & Control Plane — Opn.li / Openly Trusted Services).

Alpha decisions are *not* accidents or technical debt.

They are **deliberate scaffolding** used to validate trust lifecycle semantics under controlled conditions before MVP hardening.

All Alpha decisions must:

-   Name the constraint

-   Describe the shortcut taken

-   State the implication

-   Describe how the decision will be revisited or removed in a future sprint

***

## Alpha Operating Constraints

The OPN4 Alpha operates under the following declared constraints:

-   No outbound email, SMS, or push notifications exist

-   All user identities use fake or test accounts

-   A single human may play multiple roles (issuer, recipient, administrator)

-   All trust lifecycle steps must be observable inside the application or Supabase dashboard

-   Payload validation against the CARD v0.1 JSON Schema is declared but not yet enforced

-   The goal is to validate **trust mechanics and lifecycle invariants**, not production UX realism

These constraints are intentional and must not be silently worked around.

***

## Decision A-001: Three-plane architecture is declared but only one plane is built

**Context** The full Openly Trusted Services architecture operates across three planes: Personal Data Plane (RAGbox/PDV), Intelligence Plane (MyBody + Agents), and Trust & Control Plane (OPN4/Opn.li). OPN4.001 builds only the Trust & Control Plane.

**Alpha Choice** OPN4.001 is scoped exclusively to the Trust & Control Plane. The Personal Data Plane and Intelligence Plane are referenced in CARD payloads (via `resource.uri` and `agents[]`) but are not built, connected, or validated.

**Implication** CARD payloads reference data resources and agents that do not exist in the Alpha environment. Resource URIs (e.g., `https://ragbox.local/fhir/Observation/labs`) are structural placeholders. No data is actually retrieved, shared, or controlled. The system proves trust mechanics, not data mechanics.

**MVP Transition** Connect the Trust & Control Plane to a real PDV instance. Replace placeholder URIs with live resource references. Validate that CARD-gated access actually controls what data an agent or recipient can retrieve.

***

## Decision A-002: CARD payload is freeform JSON — schema validation is deferred

**Context** `card_forms.schema_definition` is designed to hold a JSON Schema that should validate what is inserted into `card_instances.payload`. The `enforce_registered_form()` trigger fires before INSERT on `card_instances` but currently only checks that the form is in `registered` status — it does not validate the payload against the schema.

**Alpha Choice** Payload conformance to the CARD v0.1 JSON Schema (Section 3 of the Master Spec) is aspirational in Sprint 0. A CARD instance can be created with any valid JSON, including an empty `{}`.

**Implication** Trust mechanics are proven correctly, but payload semantics are not enforced. A CARD claiming to describe a lab-sharing permission and a CARD containing `{"test": true}` are structurally identical to the database. Section 3 examples are illustrative, not validated.

**MVP Transition** Extend `enforce_registered_form()` to perform jsonb schema validation against `card_forms.schema_definition` at INSERT time. Malformed payloads must return `PAYLOAD_INVALID`. Addressed in S1-2.

***

## Decision A-003: Invitation delivery occurs in-app only

**Context** OPN4 has no messaging or notification infrastructure in the Alpha.

**Alpha Choice** When `issue_card()` is called with an `invitee_locator` (email or phone), the locator is stored in `card_deliveries` but no message is sent. The invitation link must be surfaced manually in the UI or constructed directly for testing purposes.

**Implication** Invitations to non-members cannot be delivered automatically. Real-world multi-party testing requires manual coordination between tester personas. The `invitee_locator` field is structurally correct and ready for outbound delivery, but the delivery mechanism does not yet exist.

**MVP Transition** Wire `invitee_locator` to an outbound email or SMS delivery service when `issue_card()` creates a delivery with `recipient_member_id IS NULL`. Modeled on OPN3 A-002.

***

## Decision A-004: Authentication is required for all trust acts — no anonymous flows

**Context** All RPCs are SECURITY DEFINER and use `auth.uid()` to enforce ownership (`NOT_OWNER`) and recipient identity (`NOT_RECIPIENT`). There is no anonymous or pre-authentication trust flow.

**Alpha Choice** Every trust act — form registration, instance creation, issuance, and acceptance — requires an authenticated session. Invitation links for non-members require the invitee to authenticate before claiming or accepting.

**Implication** Anonymous browsing of CARD offers is not supported. A recipient who receives an `invitee_locator`-based delivery must create an account or sign in before they can accept. This is correct architectural behaviour, not a limitation.

**MVP Transition** Consider signed, time-bound invitation tokens that allow pre-authentication preview of CARD content before requiring account creation — improving conversion without weakening trust enforcement. Modeled on OPN3 A-004.

***

## Decision A-005: SQL editor testing requires direct table access — RPCs not testable without a session

**Context** The Supabase SQL editor runs as the `postgres` superuser with no JWT session. `auth.uid()` returns null. All SECURITY DEFINER RPCs that check caller identity (`issue_card`, `resolve_card_issuance`, `get_my_recent_audit`) cannot be exercised from the SQL editor under their intended access controls.

**Alpha Choice** Sprint 0 unit tests (S0-3) that require ownership or recipient checks are verified by direct table INSERT/UPDATE, with RPC guard failures treated as positive evidence. The `NOT_OWNER` and `NOT_RECIPIENT` errors returned by the SQL editor confirm the guards are enforcing correctly — they are not test failures.

**Implication** Full end-to-end RPC testing requires a live authenticated session (via the app UI or a seeded JWT). SQL editor testing is sufficient for structural verification but cannot simulate the authenticated trust flow.

**MVP Transition** Write integration tests that run against the Supabase local emulator with seeded JWT sessions, allowing full RPC coverage without manual UI interaction.

***

## Decision A-006: Migration history contains a corrected baseline — original migrations are superseded

**Context** The OPN4 database was originally built across 8 migrations (Feb 7–9, 2026). Migration 7 contained a dependency inversion: `issue_card()` referenced `card_deliveries` before Migration 8 created it. A fresh environment would fail at Migration 7.

**Alpha Choice** Sprint 0 task S0-1 replaced the 8-migration history with a single corrected baseline migration that establishes all tables, triggers, RLS policies, and RPCs in dependency-safe order. The original migration files are superseded and should not be re-run. The live database was patched in place using the corrected baseline (idempotent execution).

**Implication** The canonical source of schema truth is `S0-1_baseline_migration_corrected.sql`. Any developer onboarding to OPN4 should run this single file against a fresh Supabase instance, not the original 8 migrations.

**MVP Transition** From Sprint 1 onwards, each schema change is a discrete forward migration. The S0-1 baseline is the starting point. No further consolidation of migration history is planned.

***

## Decision A-007: Dead code removed — log_blocked_audit() and dblink are gone

**Context** Migration 5 introduced the `dblink` extension and `log_blocked_audit()` as a workaround for writing to `audit_log` when a transaction was blocked. Migration 6 superseded this approach with the structured-return pattern used by all current RPCs.

**Alpha Choice** Sprint 0 task S0-2 drops `log_blocked_audit()` and the `dblink` extension. Neither is referenced by any live RPC. `dblink` in particular carries unnecessary attack surface as it can open arbitrary remote Postgres connections.

**Implication** The schema is clean. There are no orphaned functions. `dblink` cannot be accidentally invoked. The actual signature of `log_blocked_audit` at time of removal was `(p_action text, p_entity_type text, p_entity_id uuid, p_actor_id uuid, p_lifecycle_context jsonb)` — noted here for the record.

**MVP Transition** No action required. This decision is permanent.

***

## Decision A-008: card_instances has no versioning columns in Sprint 0

**Context** The full CARD lifecycle requires supersession: editing a CARD creates a new instance and marks the original as superseded, preserving lineage (OPN3 A-015 pattern). The Master Spec defers this to Sprint 2.

**Alpha Choice** `card_instances` is created in Sprint 0 without `superseded_by`, `superseded_at`, or `is_current` columns. Instances are immutable once created. There is no way to revise a CARD in Sprint 0 without creating a new unlinked instance.

**Implication** LIFE-INV-01 (modification creates a new instance) and OPN3 A-015 (supersession model) are not enforced. The absence of versioning is visible in the UI — there is no version history for any CARD. This is explicitly tracked as a gap in the Master Spec invariant table.

**MVP Transition** Sprint 2 task S2-1 adds `superseded_by`, `superseded_at`, and `is_current` columns. S2-2 adds the `supersede_card_instance()` RPC. This is a direct port of OPN3 A-015 onto the OPN4 foundation.

***

## Decision A-009: Revocation is not implemented in Sprint 0

**Context** LIFE-INV-03 requires that termination revokes without deleting — a revoked issuance should be invisible to the recipient but preserved in the audit trail.

**Alpha Choice** `card_issuances` supports `accepted` and `rejected` status values but has no `revoked` status in Sprint 0. There is no `revoke_card_issuance()` RPC. Once accepted, an issuance cannot be revoked through the system.

**Implication** Trust relationships established in Sprint 0 Alpha testing cannot be formally revoked. Manual deletion via the Supabase dashboard is the only recourse, which violates the audit preservation principle. This is declared, not accidental.

**MVP Transition** Sprint 2 task S2-3 adds `revoke_card_issuance()` RPC, which sets `status = 'revoked'` on both the issuance and delivery rows, logs a `card_revoked` audit event, and does not delete anything. The `card_issuance_status` enum must be extended to include `revoked`.

***

## Decision A-010: OPN4.001 closure — thread is closed at Sprint 0

**Context** OPN4.001 was scoped to prove one thing: no trust relationship or data sharing can occur without passing through explicit CARD Registration and CARD Issuance stages, and every step is auditable.

**Alpha Choice** OPN4.001 is declared closed at the end of Sprint 0 (February 11, 2026). All six unit tests pass. The migration order bug is fixed. Dead code is removed. The baseline is clean.

**What OPN4.001 proves:** Form registration is independent of issuance. Unregistered forms are blocked at the trigger level. Instance creation does not equal sharing. Issuance is explicit, directional, and auditable. Acceptance is required for effect. Every lifecycle event is recorded in correct sequence.

**What OPN4.001 does not prove:** Payload conformance, CARD versioning, supersession, revocation, cross-member data isolation under load, or any Intelligence or Personal Data Plane integration. These are intentional deferrals, not gaps.

**MVP Transition** Sprint 1 begins. The Trust & Control Plane substrate is sound. Subsequent sprints make CARDs real (Sprint 1), add lifecycle (Sprint 2), build the first real-world demo scenario (Sprint 3), and harden for partner readiness (Sprint 4).

***

## How to Use This Document

-   Each new Alpha shortcut must be recorded as a new decision (A-011, A-012, …)

-   Decisions are never deleted or rewritten — they are the permanent record of intentional choices

-   Sprint planning must explicitly reference these decisions when removing Alpha scaffolding

-   At the start of each Claude session, this document and the Master Specification should both be attached

This document is part of the OPN4 system architecture.

***

*OPN4 Alpha Decisions Log v1.0 \| Opn.li / Openly Trusted Services \| February 11, 2026 \| Confidential*
