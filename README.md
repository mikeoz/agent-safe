# My data. Your AI. My control.

**Agent Safe** is the trust layer for the Agent Economy. It ensures that every AI agent that touches your data has a registered identity, scoped permissions, real-time verification, and instant revocation — and that every interaction is permanently logged.

Think of it this way: before Visa, every store had to decide whether to trust every customer. Visa didn't make customers richer or stores better. It made the transaction trustworthy. Agent Safe does the same thing for AI agents.

---

## What It Does

When an AI agent wants to access your data, Agent Safe asks three questions:

1. **Who are you?** Every agent must have a registered identity (Entity CARD) with a named, accountable operator.
2. **What are you allowed to do?** Every data access requires an explicit, scoped permission (Use CARD) issued by the data owner — with purpose, time limits, and restrictions.
3. **Are you still allowed?** A real-time Verification Endpoint checks the agent's authorization at the moment of access. If the permission has been revoked, access is denied instantly.

The data owner can revoke any permission at any time. Revocation takes effect immediately, globally, permanently.

Every permission grant, every access check, every revocation is recorded in a tamper-evident audit log.

## How It Works

Agent Safe uses a typed authorization instrument called a **CARD** (Community Approved Reliable Data):

| CARD Type | What It Does | Example |
|---|---|---|
| **Entity CARD** | Registers an agent's identity and operator | "My Health Assistant, operated by Opn.li" |
| **Data CARD** | Describes a governed data resource | "My glucose readings — sensitive health data" |
| **Use CARD** | Grants scoped, time-bound, revocable access | "My Health Assistant may read my glucose data for trend analysis, until Dec 31, no storage allowed" |

The **Verification Endpoint** is the front door. Any system can query it in real time: *"Is this agent authorized to access this data right now?"* The answer is instant, composite, and machine-readable.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Data Owner   │────▶│   Agent Safe     │◀────│    AI Agent      │
│  (Principal)  │     │   Trust Layer    │     │  (CARD-carrying) │
└──────────────┘     └──────────────────┘     └──────────────────┘
                            │
                     ┌──────┴──────┐
                     │ Verification │
                     │  Endpoint    │
                     │ (Front Door) │
                     └─────────────┘
```

- **Supabase Postgres** — Entity CARDs, Data CARDs, Use CARDs, audit log
- **Edge Function** — Verification Endpoint with rate limiting, API key authentication, and CORS protection
- **React Frontend** — Permission slip wizard, audit trail viewer, agent management (built with Lovable)
- **Row-Level Security** — Every query is scoped to the authenticated user
- **Hash Chain Audit** — SHA-256 chain on audit entries for tamper evidence

## Quick Start

### Prerequisites

- A Supabase account (free tier is sufficient for evaluation)
- Node.js 18+

### Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```
3. Run the schema migrations in order:
   ```
   schema/migrations/001-core-tables.sql
   schema/migrations/002-rls-policies.sql
   schema/migrations/003-rpcs-core.sql
   schema/migrations/004-rpcs-lifecycle.sql
   schema/migrations/005-payload-validation.sql
   schema/migrations/006-verification-endpoint.sql
   ```
4. Seed the demo data:
   ```
   demo/seed/bob-bethany-demo-seed.sql
   ```
5. Deploy the Edge Function (`endpoint/index.ts`) to your Supabase project
6. Add a `VERIFY_API_KEY` secret to your Supabase Edge Function secrets
7. Start the frontend:
   ```bash
   npm install
   npm run dev
   ```

### Demo Flow

Log in as the demo user (Bob Bethany). You'll see:

- **Entities & Agents** — "My Health Assistant" is registered with an active Entity CARD
- **Data Rooms** — Three data resources (glucose, medications, appointments) each with Data CARDs
- **CARDs** — Write a permission slip to grant the agent access to your data
- **Activities & Reports** — Every action is logged with timestamps

## CARD Specification

The CARD schema is defined in `schema/schemas/card-v0.1.json`. The full specification is being submitted as a W3C Community Group deliverable.

The Verification Endpoint response schema follows OPN4 Master Specification v2.5, Section 5.8, including the SF-02 trust_summary composite field.

## For Developers

**Making a skill CARD-ready:** If you build AI agent skills (for OpenClaw or any agent framework), Agent Safe provides the trust infrastructure your skill needs to pass enterprise procurement. A CARD-ready skill has a registered identity, scoped authorization, and an audit trail.

**Verification Endpoint integration:** Your agent or platform calls the VE before accessing governed data:

```
GET /functions/v1/verify-card?agent_id={agent_uri}
Header: x-api-key: {your_api_key}
```

The response tells you: entity status, operator identity, active permissions, restrictions, and a computed trust summary — in one call.

## Security

See [docs/security-notice.md](docs/security-notice.md) for a transparent statement of what Agent Safe does and does not protect.

See [docs/production-hardening.md](docs/production-hardening.md) for guidance on deploying with regulated data (HIPAA, SOC 2, GDPR).

## Status

This is a reference implementation. The live system is deployed on Supabase with:

- ✅ Row-Level Security on all tables (no cross-user data leakage)
- ✅ Auth guards on all write RPCs
- ✅ Rate-limited Verification Endpoint with API key authentication
- ✅ Payload validation on CARD creation
- ✅ Idempotency guards on write operations
- ✅ SHA-256 hash chain on audit log entries
- ✅ Duplicate submission guard on the UI

## License

This project is the reference implementation for the CARD specification. The specification is intended for submission to W3C under Royalty-Free licensing terms. See LICENSE for details.

## About

**Opn.li** (Openly Trusted Services) operates the Trust Network for the Agent Economy. We don't build agents. We don't compete with platforms. We make every agent transaction trustworthy.

*My data. Your AI. My control.*

Patent pending: US Provisional Application 63/992,579 (filed February 27, 2026).
