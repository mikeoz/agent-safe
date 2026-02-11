import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, form_type, schema_definition } = await req.json();

    if (!name || !form_type || !schema_definition) {
      return new Response(
        JSON.stringify({ error: "name, form_type, and schema_definition are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["entity", "data", "use"].includes(form_type)) {
      return new Response(
        JSON.stringify({ error: "form_type must be entity, data, or use" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role — no user context, so auth.uid() = NULL inside DB functions
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Direct insert (not via RPC) to ensure actor_id = NULL
    const { data: formId, error: formError } = await supabaseAdmin
      .from("card_forms")
      .insert({
        name,
        form_type,
        schema_definition,
        status: "registered",
        registered_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (formError) throw formError;

    // Write audit with actor_id = NULL (system action)
    const { error: auditError } = await supabaseAdmin
      .from("audit_log")
      .insert({
        action: "form_registered",
        entity_type: "card_form",
        entity_id: formId.id,
        actor_id: null,
        lifecycle_context: {
          form_name: name,
          form_type,
          registration_mode: "system_alpha",
        },
      });

    if (auditError) throw auditError;

    return new Response(
      JSON.stringify({ id: formId.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
