import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: Replace the Lovable domain below with your actual app URL.
// During development, you can keep the wildcard fallback.
// Before LAUNCH, restrict to your production domain ONLY.
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function corsHeaders(origin?: string | null): Record<string, string> {
  const effectiveOrigin =
    ALLOWED_ORIGIN === "*"
      ? "*"
      : origin && origin === ALLOWED_ORIGIN
      ? ALLOWED_ORIGIN
      : "null";
  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
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
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use GET." }),
      { status: 405, headers: CORS }
    );
  }

  // ── API Key Gate (QAS-C3) ──────────────────────────────────
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("VERIFY_API_KEY");

  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(
      JSON.stringify({ error: "Unauthorized. Valid x-api-key header required." }),
      { status: 401, headers: CORS }
    );
  }

  // ── Parse parameters ───────────────────────────────────────
  const url = new URL(req.url);
  const agent_id = url.searchParams.get("agent_id");
  const card_ref = url.searchParams.get("card_ref");

  if (!agent_id) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: agent_id" }),
      { status: 400, headers: CORS }
    );
  }

  // ── Supabase client (service role for DB access) ───────────
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Rate Limiting (QAS-C3) ─────────────────────────────────
  try {
    const { data: allowed, error: rlErr } = await supabase.rpc(
      "check_rate_limit",
      { p_identifier: agent_id, p_endpoint: "verify-card" }
    );

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
        }