# Production Hardening Guide

**Agent Safe — Deployment Guide for Regulated Environments**

Version 1.0 | March 1, 2026

---

## Overview

This guide covers the additional infrastructure controls required when deploying Agent Safe with regulated data (HIPAA, PCI DSS, SOC 2 Type II, GDPR). The reference implementation provides the application-layer trust architecture. Production deployments must add the infrastructure controls described in this document.

This guide is organized by compliance domain. Each section specifies the requirement, the current state of the reference implementation, and the recommended implementation path.

---

## 1. Transport Layer Security (TLS)

### Requirement

All data in transit must be encrypted using TLS 1.2 or higher. This applies to:
- Client to frontend (browser to React app)
- Frontend to Supabase (API calls)
- Edge Function to database (VE queries)
- Agent to Verification Endpoint (trust queries)

### Current State

Supabase enforces TLS on all connections by default. Lovable serves the frontend over HTTPS. The reference implementation meets this requirement without additional configuration.

### Production Additions

- **Enforce TLS 1.3 minimum** on any custom domains or reverse proxies
- **Enable HSTS** (HTTP Strict Transport Security) with a minimum max-age of 1 year
- **Certificate pinning** for agent-to-VE communication in enterprise deployments where the agent runtime is controlled
- **Disable TLS 1.0 and 1.1** on any infrastructure you control
- **Monitor certificate expiration** — set alerts for 30-day and 7-day expiry warnings

---

## 2. Key Management

### Requirement

All cryptographic keys, API keys, and secrets must be managed through a dedicated key management system with access controls, rotation policies, and audit logging.

### Current State

The reference implementation uses two keys:
- **Supabase anon key** — embedded in the frontend JavaScript bundle (inherent to Supabase + SPA architecture). Protected by RLS — the key alone cannot access data without authentication.
- **VERIFY_API_KEY** — stored in Supabase Edge Function secrets. Required for VE access.

Key rotation is limited by the Lovable Cloud architecture (Supabase keys are managed by Lovable).

### Production Additions

- **Use a dedicated key management service** (AWS KMS, Google Cloud KMS, HashiCorp Vault) for all secrets
- **Rotate the VERIFY_API_KEY** on a 90-day cycle minimum, or immediately on suspected compromise
- **Implement API key scoping** — different keys for different callers with different permission levels
- **Log all key access** — every read of a secret should generate an audit event in the KMS
- **Separate keys by environment** — development, staging, and production must use different keys
- **For Supabase self-hosted deployments:** rotate the JWT secret, anon key, and service_role key on a defined schedule. Store in Vault, not in environment variables.

---

## 3. Entity CARD Data Protection

### Requirement

Entity CARDs contain operator identity information (name, identifier) that constitutes personal data under GDPR, CCPA, and similar regulations. Production deployments must protect this data with controls appropriate to its classification.

### Current State

Entity CARD payloads are stored as JSONB in Postgres. Access is controlled by RLS (owner-only reads) and authenticated RPCs. Data is encrypted at rest by Supabase (disk-level AES-256). The Verification Endpoint returns operator identity to authenticated callers with a valid API key.

### Production Additions

**Application-level field encryption:**
```
Encrypt: operator.name, operator.id, any custom PII fields
Algorithm: AES-256-GCM
Key: Per-member encryption key, derived from master key in KMS
Storage: Encrypted ciphertext in JSONB; decryption at application layer only
```

**VE response tiering:**
| Caller Type | Entity Data Returned |
|---|---|
| Agent (standard API key) | Entity status only (active/revoked/unknown) |
| Platform (partner API key) | Entity status + operator display name |
| Owner (authenticated session) | Full Entity CARD payload |
| Enterprise (certified API key) | Configurable per data-sharing agreement |

**Data retention:**
- Active Entity CARDs: retained indefinitely while active
- Deactivated Entity CARDs: retain for 90 days, then anonymize payload (preserve audit chain)
- On operator erasure request: anonymize within 30 days, preserve hashed audit entries

**GDPR-specific:**
- Maintain a Record of Processing Activities (ROPA) for Entity CARD data
- Conduct a Data Protection Impact Assessment (DPIA) before processing at scale
- Designate a data controller and, if required, a Data Protection Officer (DPO)
- Implement a data subject access request (DSAR) procedure: export all Entity CARD data for a member on request

---

## 4. Backup Strategy

### Requirement

Production deployments must implement automated backups with defined retention, tested recovery procedures, and geographic redundancy.

### Current State

Supabase free tier does not include automated backups. Pro tier ($25/month) includes daily backups with 7-day retention.

### Production Additions

- **Upgrade to Supabase Pro** (minimum) for daily automated backups
- **Point-in-time recovery (PITR)**: Available on Supabase Pro add-on. Enables recovery to any point within the retention window. Required for SOC 2.
- **Geographic redundancy**: For enterprise deployments, replicate backups to a separate cloud region
- **Backup encryption**: Ensure backups are encrypted at rest (Supabase handles this on managed infrastructure)
- **Recovery testing**: Test backup restoration quarterly. Document the procedure and the recovery time objective (RTO)
- **Backup retention schedule**:

| Data Type | Retention | Rationale |
|---|---|---|
| Full database backup | 30 days rolling | Operational recovery |
| Audit log archive | 7 years | SOC 2 / HIPAA requirement |
| Entity CARD snapshots | Per data retention policy | GDPR compliance |

---

## 5. Compliance Mapping

### SOC 2 Type II

| SOC 2 Criteria | Agent Safe Control | Production Addition |
|---|---|---|
| CC6.1 — Logical access | RLS, auth guards, API key gate | Implement role-based access control (RBAC) for admin operations |
| CC6.2 — Credentials | Supabase Auth (email/password) | Add MFA requirement for all users. Enforce password complexity. |
| CC6.3 — Authorization | Use CARD issuance with bilateral acceptance | Document authorization matrix. Implement periodic access reviews. |
| CC7.1 — Configuration management | Schema migrations, versioned RPCs | Implement change management process. Require approval for schema changes. |
| CC7.2 — Change management | Git-tracked migrations | Add CI/CD pipeline with automated testing before deploy |
| CC8.1 — Incident response | Audit log with hash chain | Implement incident response plan. Define severity levels and escalation. |
| A1.2 — Availability | Single Supabase instance | Add monitoring, alerting, and failover. Define SLA. |
| PI1.1 — Privacy notice | Security notice in repo | Add privacy policy. Implement consent management for data subjects. |

### HIPAA

| HIPAA Requirement | Agent Safe Control | Production Addition |
|---|---|---|
| §164.312(a)(1) — Access control | RLS, authenticated RPCs | Implement unique user identification. Emergency access procedure. |
| §164.312(b) — Audit controls | Audit log with hash chain | Implement log review procedures. Retain logs for 6 years. |
| §164.312(c)(1) — Integrity | Hash chain tamper evidence | Implement integrity verification schedule (daily). |
| §164.312(d) — Authentication | Supabase Auth | Implement MFA. Session timeout (15 minutes). |
| §164.312(e)(1) — Transmission security | TLS (Supabase default) | Enforce TLS 1.3. Certificate pinning for agent communication. |
| §164.308(a)(1)(ii)(A) — Risk analysis | QAS Security Audit | Conduct annual risk analysis. Document and remediate findings. |
| §164.308(a)(6) — Security incident | Audit log, VE logging | Implement breach notification procedure (60-day rule). |
| BAA requirement | N/A | Execute Business Associate Agreements with Supabase (or self-host) and any infrastructure provider |

### GDPR

| GDPR Article | Agent Safe Control | Production Addition |
|---|---|---|
| Art. 5 — Data principles | Purpose-scoped Use CARDs | Document lawful basis for each processing activity |
| Art. 6 — Lawful basis | Explicit consent via bilateral acceptance | Implement consent records with timestamps |
| Art. 7 — Conditions for consent | Use CARD issuance requires explicit acceptance | Ensure consent withdrawal (revocation) is as easy as granting |
| Art. 15 — Right of access | Data scoped to authenticated user | Implement data export functionality (DSAR) |
| Art. 17 — Right to erasure | Not yet implemented | Implement erasure workflow with audit chain preservation |
| Art. 25 — Data protection by design | Three-tier enforcement architecture | Document privacy-by-design assessment |
| Art. 30 — Records of processing | Audit log | Maintain formal ROPA |
| Art. 32 — Security of processing | RLS, auth, encryption at rest | Implement all controls in this guide |
| Art. 33 — Breach notification | Audit log, hash chain | Implement 72-hour notification procedure to supervisory authority |
| Art. 35 — DPIA | Not yet conducted | Conduct DPIA before processing personal data at scale |

---

## 6. Monitoring and Alerting

### Production Requirements

| Monitor | Threshold | Alert Channel |
|---|---|---|
| VE response time | > 500ms p99 | PagerDuty / Slack |
| VE error rate | > 1% of requests | PagerDuty |
| Rate limit triggers | > 10 per hour | Slack (informational) |
| Failed auth attempts | > 50 per hour per IP | PagerDuty |
| Audit chain verification | Any `chain_valid = false` | PagerDuty (critical) |
| Database storage | > 80% of tier limit | Slack |
| Edge Function invocations | > 80% of monthly limit | Slack |
| Backup job failure | Any failure | PagerDuty |

### Implementation

For the reference implementation on Supabase, use:
- Supabase Dashboard (Pro tier) for database metrics
- Supabase Logs for Edge Function monitoring
- A scheduled `verify_audit_chain()` call (daily via pg_cron or external cron) with alert on failure

For enterprise self-hosted deployments, integrate with your existing monitoring stack (Datadog, Grafana, CloudWatch).

---

## 7. Network Security

### Production Additions

- **Web Application Firewall (WAF)** in front of the Verification Endpoint
- **DDoS protection** — Cloudflare or AWS Shield for the VE endpoint
- **IP allowlisting** for administrative database access
- **VPN requirement** for direct database connections
- **Network segmentation** between the trust layer, data plane, and application plane (per the three-plane architecture in the specification)

---

## 8. Implementation Priority

For organizations evaluating Agent Safe for production deployment:

| Phase | Actions | Timeline |
|---|---|---|
| **Evaluation** | Deploy reference implementation. Run demo. Review this guide. | Week 1 |
| **POC** | Upgrade to Supabase Pro. Enable backups. Implement TLS hardening. Add MFA. | Week 2–3 |
| **Pilot** | Implement field-level encryption for Entity CARDs. Conduct DPIA if EU data. Execute BAA with Supabase. | Week 4–6 |
| **Production** | Complete compliance mapping for your regulatory requirements. Implement monitoring. Test backup recovery. Conduct penetration test. | Week 7–12 |

---

*This guide will be updated as the Agent Safe architecture evolves. For questions about production deployment, contact: enterprise@opn.li*

*Opn.li / Openly Trusted Services*

*My data. Your AI. My control.*
