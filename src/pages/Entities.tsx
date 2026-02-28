import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { EntityDetailPanel } from "@/components/entities/EntityDetailPanel";
import { QueryState } from "@/components/QueryState";

const ENTITY_FORM_ID = "96583b62-2ee5-40e3-a633-fb14e88e888b";

const KIND_STYLE: Record<string, string> = {
  agent: "bg-teal-100 text-teal-800 border-teal-200",
  person: "bg-blue-100 text-blue-800 border-blue-200",
  org: "bg-gray-100 text-gray-700 border-gray-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function truncateUrn(urn: string): string {
  const after = urn.replace("urn:uuid:", "");
  return after.slice(0, 16) + "…";
}

interface EntityRow {
  id: string;
  payload: any;
  created_at: string;
}

export default function Entities() {
  usePageTitle(useLocation().pathname);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EntityRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || "";

    const { data, error: queryError } = await supabase
      .from("card_instances")
      .select("id, payload, created_at")
      .eq("form_id", ENTITY_FORM_ID)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as EntityRow[];
    const filtered = rows.filter(
      (row) => !row.payload?.parties?.subject?.id?.includes(userId)
    );

    const seen = new Set<string>();
    const deduped: EntityRow[] = [];
    filtered.forEach((row) => {
      const cardId = row.payload?.card?.id;
      if (cardId && seen.has(cardId)) return;
      if (cardId) seen.add(cardId);
      deduped.push(row);
    });

    setEntities(deduped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Entities &amp; Agents</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Everyone in your trust network — people, organizations, and agents.
      </p>

      <QueryState
        loading={loading}
        error={error}
        onRetry={load}
        isEmpty={entities.length === 0}
        emptyMessage="No entities or agents registered yet."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {entities.map((row) => {
            const p = row.payload as any;
            const subject = p?.parties?.subject;
            const name = subject?.display_name || p?.card?.title || "Unnamed";
            const kind = subject?.kind || "entity";
            const operator = p?.parties?.operator?.display_name;
            const claim = p?.claims?.items?.[0];
            const caps = claim?.agent_metadata?.capabilities;
            const model = claim?.agent_metadata?.model;
            const modelStr = model ? `${model.provider} / ${model.name}` : null;
            const status = p?.lifecycle?.status;
            const agentId = subject?.id || "";

            return (
              <Card key={row.id} className="border-l-4 overflow-hidden cursor-pointer hover:shadow-md transition-shadow" style={{ borderLeftColor: "#1F4E8C" }} onClick={() => setSelected(row)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base leading-tight">{name}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${KIND_STYLE[kind] || KIND_STYLE.org}`}>
                      {kind}
                    </span>
                    {status === "active" && (
                      <span className="inline-flex items-center gap-1 text-xs text-vault-green font-medium">
                        <span className="inline-block h-2 w-2 rounded-full bg-vault-green" />
                        Active
                      </span>
                    )}
                  </div>
                  {operator && <p className="text-xs text-muted-foreground">Operated by: {operator}</p>}
                  {caps && Array.isArray(caps) && caps.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Capabilities: {caps.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")}
                    </p>
                  )}
                  {modelStr && <p className="text-xs text-muted-foreground">Model: {modelStr}</p>}
                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground/70">
                    <span>Registered {formatDate(row.created_at)}</span>
                  </div>
                  {agentId && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                      <span className="font-mono">{truncateUrn(agentId)}</span>
                      <CopyIdButton value={agentId} label="ID" variant="inline" className="text-muted-foreground/60" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </QueryState>

      <EntityDetailPanel open={!!selected} onClose={() => setSelected(null)} entity={selected} />
    </div>
  );
}
