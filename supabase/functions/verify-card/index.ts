/**
 * CARD Verification Endpoint — Reference Implementation
 *
 * This Edge Function implements the CARD Verification Endpoint interface,
 * which is part of the Royalty-Free CARD protocol.
 *
 * The internal implementation details (authentication, rate limiting,
 * audit logging) are provided as a reference. Operating these mechanisms
 * as part of a trust network verification service may be subject to
 * US Provisional Patent Application 63/992,579.
 *
 * See LICENSE in the repository root for full terms.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: Replace the Lovable domain below with your actual app URL.
// During development, you can keep the wildcard fallback.
// Before LAUNCH, restrict to your production domain ONLY.
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function corsHeaders(origin?: string | null): Record<string, string> {
  const effectiveOrigin = ALLOWED_ORIGIN === "*" ? "*" : origin && origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null";
  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const CORS = corsHeaders(origin);

  // ── Preflight ──────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET." }), { status: 405, headers: CORS });
  }

  // ── API Key Gate (QAS-C3) ──────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("VERIFY_API_KEY");

  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized. Valid x-api-key header required." }), {
      status: 401,
      headers: CORS,
    });
  }

  // ── Parse parameters ───────────────────────────────────────
  const url = new URL(req.url);
  const agent_id = url.searchParams.get("agent_id");
  const card_ref = url.searchParams.get("card_ref");

  if (!agent_id) {
    return new Response(JSON.stringify({ error: "Missing required parameter: agent_id" }), {
      status: 400,
      headers: CORS,
    });
  }

  // ── Supabase client (service role for DB access) ───────────
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ── Rate Limiting (QAS-C3) ─────────────────────────────────
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc("check_rate_limit", {
      p_identifier: agent_id,
      p_endpoint: "verify-card",
    });

    if (rlErr) {
      console.error("Rate limit check failed:", rlErr.message);
      // Fail open on rate limit errors — don't block legitimate requests
      // because of a DB hiccup. Log it and continue.
    } else if (allowed === false) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Max 100 requests/minute per agent_id, 1000/minute global.",
          retry_after_seconds: 60,
        }),
        {
          status: 429,
          headers: { ...CORS, "Retry-After": "60" },
        },
      );
    }
  } catch (rlCatchErr: any) {
    console.error("Rate limit exception:", rlCatchErr.message);
  }

  // ── Cleanup old rate limit rows (lightweight) ──────────────
  try {
    await supabase.rpc("cleanup_rate_limits", { p_max_age_seconds: 3600 });
  } catch (_) {
    // Non-critical — if cleanup fails, the table just grows a bit
  }

  const verified_at = new Date().toISOString();

  try {
    // STEP 1: Resolve the agent's Entity CARD
    const { data: entityInstances, error: entityErr } = await supabase
      .from("card_instances")
      .select(
        `
        id,
        member_id,
        payload,
        card_forms!inner(form_type, status)
      `,
      )
      .eq("card_forms.form_type", "entity")
      .eq("card_forms.status", "registered");

    if (entityErr) throw entityErr;

    const entityInstance = entityInstances?.find(
      (inst: any) => inst.id === agent_id || inst.payload?.card?.id === agent_id || `urn:uuid:${inst.id}` === agent_id,
    );

    let entity_status: "active" | "revoked" | "suspended" | "unknown" = "unknown";
    let operator: { id: string; display_name: string } | null = null;
    let entity_member_id: string | null = null;

    if (entityInstance) {
      entity_member_id = entityInstance.member_id;

      const { data: entityIssuances } = await supabase
        .from("card_issuances")
        .select("status")
        .eq("instance_id", entityInstance.id)
        .order("issued_at", { ascending: false })
        .limit(1);

      if (entityIssuances && entityIssuances.length > 0) {
        const latestIssuance = entityIssuances[0];
        if (latestIssuance.status === "accepted") {
          entity_status = "active";
        } else if (latestIssuance.status === "revoked" || latestIssuance.status === "rejected") {
          entity_status = "revoked";
        } else if (latestIssuance.status === "issued") {
          entity_status = "suspended";
        } else {
          entity_status = "unknown";
        }
      } else {
        entity_status = "active";
      }

      const payload = entityInstance.payload;
      if (payload?.parties?.operator) {
        operator = {
          id: payload.parties.operator.id || "",
          display_name: payload.parties.operator.display_name || "",
        };
      } else if (payload?.card?.operator) {
        operator = {
          id: payload.card.operator.id || "",
          display_name: payload.card.operator.display_name || "",
        };
      }
    }

    // STEP 2: Find active Use CARDs for this agent
    const { data: useIssuances, error: useErr } = await supabase
      .from("card_issuances")
      .select(
        `
        id,
        instance_id,
        issuer_id,
        recipient_member_id,
        status,
        issued_at,
        resolved_at,
        card_instances!inner(
          id,
          member_id,
          payload,
          card_forms!inner(form_type, status)
        )
      `,
      )
      .eq("status", "accepted")
      .eq("card_instances.card_forms.form_type", "use")
      .eq("card_instances.card_forms.status", "registered");

    if (useErr) throw useErr;

    const now = new Date();
    const active_use_cards: any[] = [];

    for (const issuance of useIssuances || []) {
      const inst = issuance.card_instances as any;
      const payload = inst?.payload;

      const agentInPayload =
        payload?.parties?.agent?.id === agent_id ||
        payload?.parties?.agent?.id === `urn:uuid:${agent_id?.replace("urn:uuid:", "")}` ||
        inst?.member_id === entity_member_id ||
        issuance.recipient_member_id === entity_member_id;

      if (!agentInPayload) continue;

      if (card_ref) {
        const thisRef = inst.id || `urn:uuid:${inst.id}`;
        if (thisRef !== card_ref && `urn:uuid:${inst.id}` !== card_ref) continue;
      }

      const effectiveFrom = payload?.lifecycle?.effective?.from ? new Date(payload.lifecycle.effective.from) : null;
      const effectiveTo = payload?.lifecycle?.effective?.to ? new Date(payload.lifecycle.effective.to) : null;

      if (effectiveFrom && now < effectiveFrom) continue;
      if (effectiveTo && now > effectiveTo) continue;

      const claims = payload?.claims || {};
      const resources = (claims.items || [])
        .map((item: any) => ({
          uri: item?.resource?.uri || null,
          label: item?.resource?.display_name || item?.resource?.label || null,
        }))
        .filter((r: any) => r.uri);

      const actions = claims.allowed_actions || payload?.policy?.allowed_actions || [];
      const purpose = payload?.policy?.purpose ? [payload.policy.purpose] : payload?.claims?.purpose || [];

      const prohibitions = (payload?.policy?.prohibitions || []).map((p: any) => ({
        code: p.code || p.type || p,
        enforcement_tier: p.enforcement_tier || "contractual",
      }));

      active_use_cards.push({
        card_ref: `urn:uuid:${inst.id}`,
        issuance_id: issuance.id,
        scope_summary: {
          resources,
          actions,
          purpose: Array.isArray(purpose) ? purpose : [purpose],
        },
        effective: {
          from: effectiveFrom?.toISOString() || issuance.issued_at,
          to: effectiveTo?.toISOString() || null,
        },
        prohibitions,
      });
    }

    // STEP 3: Audit log
    if (entityInstance?.id) {
      const { error: auditErr } = await supabase.from("audit_log").insert({
        actor_id: null,
        action: "verification_queried",
        entity_type: "card_instance",
        entity_id: entityInstance.id,
        lifecycle_context: {
          agent_id,
          card_ref: card_ref || null,
          entity_status,
          active_use_card_count: active_use_cards.length,
          queried_at: verified_at,
          caller_ip: req.headers.get("x-forwarded-for") || null,
        },
      });

      if (auditErr) {
        console.error("Audit log insert failed:", auditErr.message);
      }
    }

    // STEP 4: Response
    const responseBody = {
      agent_id,
      entity_status,
      operator: operator || { id: "", display_name: "Unknown" },
      active_use_cards,
      verified_at,
    };

    return new Response(JSON.stringify(responseBody, null, 2), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("verify-card error:", err);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        detail: err?.message || "Unknown error",
      }),
      { status: 500, headers: CORS },
    );
  }
});
