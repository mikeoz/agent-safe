import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
    authHeader.replace("Bearer ", ""),
  );
  if (claimsErr || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse request body
  const { agent_id, card_ref } = await req.json();
  if (!agent_id) {
    return new Response(JSON.stringify({ error: "agent_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Call verify-card with the secret API key
  const verifyUrl = new URL(`${Deno.env.get("SUPABASE_URL")}/functions/v1/verify-card`);
  verifyUrl.searchParams.set("agent_id", agent_id);
  if (card_ref) verifyUrl.searchParams.set("card_ref", card_ref);

  const apiKey = Deno.env.get("VERIFY_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "VERIFY_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verifyRes = await fetch(verifyUrl.toString(), {
    method: "GET",
    headers: { "x-api-key": apiKey },
  });

  const body = await verifyRes.text();
  return new Response(body, {
    status: verifyRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
