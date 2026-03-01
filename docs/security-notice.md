# Security Notice

**Agent Safe — Reference Implementation**

Version 1.0 | March 1, 2026

---

## What Agent Safe Protects

Agent Safe provides permission-based access control, real-time verification, and audit logging for AI agent interactions with user data. Specifically:

**Identity verification.** Every agent must register an Entity CARD with a stable identifier and a named, accountable operator before it can participate in the Trust Network. Unregistered agents cannot access governed data.

**Scoped, revocable authorization.** Data access requires an explicit Use CARD issued by the data owner, specifying: which agent, which data, what actions, what purpose, what restrictions, and what time window. The data owner can revoke any Use CARD at any time. Revocation takes effect immediately.

**Real-time verification.** The Verification Endpoint checks an agent's authorization status at the moment of a data access request. If the agent's Entity CARD is revoked, or no active Use CARD exists for the requested resource, access is denied. The endpoint is rate-limited (100 requests/minute per agent, 1,000/minute global) and requires API key authentication.

**Audit trail.** Every trust lifecycle event — registration, issuance, acceptance, revocation, verification query — is recorded in an append-only audit log. Audit entries are linked by a SHA-256 hash chain, making tampering detectable. The `verify_audit_chain()` function checks chain integrity on demand.

**Row-Level Security.** All database tables enforce row-level security. Users can only access their own data. All write operations require authentication. Direct API access without a valid user session returns empty results or authentication errors.

**Payload validation.** CARD payloads are validated against the registered form's schema definition at the database level. Malformed payloads are rejected before they enter the system.

**Idempotency.** The `create_card_instance` and `issue_card` RPCs accept an optional idempotency key. Duplicate requests with the same key return the original result instead of creating duplicates.

---

## What Agent Safe Does Not Protect

Transparency requires honesty about limitations:

**Runtime data-use enforcement.** Agent Safe verifies permissions *before* data access but does not monitor what an agent does with data *after* access is granted. A Use CARD may prohibit storage or training, but these are contractual obligations enforced through the attestation protocol (planned), not real-time technical controls. The Safe Strip and Auto-Audit enforcement patterns are specified in the architecture but not yet implemented in this reference implementation.

**Cryptographic tamper-proofing.** The audit log hash chain detects tampering after the fact. It does not *prevent* a compromised database administrator from modifying records. The hash chain makes tampering evident to any party who runs `verify_audit_chain()`, but it is not a blockchain or distributed ledger — it runs within a single database instance.

**Network-level data isolation.** Data travels over standard HTTPS connections. Agent Safe does not provide encrypted tunnels, Trusted Execution Environments (TEE), or data-in-use protection beyond what TLS provides in transit and Supabase provides at rest.

**Application-level encryption.** CARD payloads (including Entity CARD data) are stored as JSONB in Postgres. Supabase encrypts the underlying storage at the disk level (AES-256), but payloads are not encrypted at the application level. A database administrator with direct access can read payload contents.

**Right to erasure.** The current implementation does not include a data deletion procedure for GDPR Article 17 or similar right-to-erasure requirements. The audit log is designed to be append-only and permanent. A production deployment handling EU personal data must implement a data retention and erasure policy.

---

## Entity CARD Data Protection

Entity CARDs contain information that may constitute personal data: agent name, operator name, operator identifier, capabilities, and lifecycle status. For agents operated by individuals, this connects a real person to a specific agent identity.

### Current Protections

| Protection | Implementation | Status |
|---|---|---|
| Access control | RLS restricts Entity CARD reads to the owning member | ✅ Active |
| Authentication | All write operations require authenticated session | ✅ Active |
| Auth guards | RPCs reject unauthenticated calls | ✅ Active |
| Audit logging | Entity CARD lifecycle events are logged with hash chain | ✅ Active |
| VE access control | Verification Endpoint requires API key | ✅ Active |
| Rate limiting | VE rate-limited to prevent enumeration | ✅ Active |
| Encryption at rest | Supabase disk-level AES-256 encryption | ✅ Provided by Supabase |

### Known Gaps (for production deployments)

| Gap | Risk | Mitigation Path |
|---|---|---|
| No application-level encryption of Entity payload fields | Database admin can read operator PII in cleartext | Implement field-level encryption for operator.name and operator.id (AES-256-GCM with per-member key) |
| No field-level access control on VE response | VE returns full operator object to any authenticated caller | Implement scoped response profiles: minimal (status only), standard (name + status), full (all fields) |
| No data retention policy | Entity data persists indefinitely | Implement configurable retention with automated purge for deactivated entities |
| No right-to-erasure procedure | GDPR non-compliance for EU operators | Implement erasure workflow: anonymize Entity CARD payload, preserve audit hash chain integrity with redaction markers |
| VE response exposes operator identity | Agent identity is queryable by any API key holder | Assess whether operator name should be redacted from VE responses for non-authorized callers |

### Recommendations for Production

1. **Encrypt Entity CARD operator fields** at the application level before storing in the payload JSONB. Decrypt only when rendering to the authenticated owner or when constructing VE responses for authorized callers.
2. **Implement VE response tiers** — callers with different API key scopes receive different levels of detail about the agent's identity.
3. **Define a data retention policy** — how long Entity CARD data persists after deactivation, and what happens on operator request for deletion.
4. **Conduct a GDPR Data Protection Impact Assessment (DPIA)** before processing EU personal data through Entity CARDs.

---

## Deployment Context

This reference implementation runs on Supabase (currently free tier, upgrading to Pro before LAUNCH Festival). It is suitable for evaluation, development, and demonstration.

For production deployments handling regulated data (HIPAA, PCI DSS, SOC 2, GDPR), additional infrastructure controls are required. See [production-hardening.md](production-hardening.md) for detailed guidance.

---

## Reporting Security Issues

If you discover a security vulnerability in Agent Safe, please report it responsibly. Do not open a public GitHub issue. Contact: security@opn.li

---

*Opn.li / Openly Trusted Services*

*My data. Your AI. My control.*
