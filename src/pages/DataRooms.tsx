import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { DataRoomDetailPanel } from "@/components/data/DataRoomDetailPanel";

const DATA_FORM_ID = "147a8e87-46f6-4145-b27e-87abbf8cdb77";

interface DataRoom {
  id: string;
  payload: any;
  created_at: string;
  accessCount: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function extractResourceName(claim: any): string {
  if (claim?.resource?.display_name) return claim.resource.display_name;
  const uri = claim?.resource?.uri || "";
  const parts = uri.split("/");
  return parts[parts.length - 1] || uri;
}

function formatActions(actions: string[] | undefined): string {
  if (!actions || actions.length === 0) return "";
  if (actions.length === 1 && actions[0] === "read") return "Read only";
  return actions.map((a) => a.charAt(0).toUpperCase() + a.slice(1)).join(", ");
}

export default function DataRooms() {
  usePageTitle(useLocation().pathname);
  const [rooms, setRooms] = useState<DataRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DataRoom | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch data card instances
      const { data: instances } = await supabase
        .from("card_instances")
        .select("id, payload, created_at")
        .eq("form_id", DATA_FORM_ID)
        .order("created_at", { ascending: true });

      if (!instances || instances.length === 0) {
        setRooms([]);
        setLoading(false);
        return;
      }

      // Count agents with active access via Use CARDs referencing each data room
      const { data: acceptedIssuances } = await supabase
        .from("card_issuances")
        .select("id, instance_id")
        .eq("status", "accepted");

      const countMap: Record<string, number> = {};

      if (acceptedIssuances && acceptedIssuances.length > 0) {
        const issuanceInstanceIds = acceptedIssuances.map((i) => i.instance_id);
        const { data: useInstances } = await supabase
          .from("card_instances")
          .select("id, payload, form_id")
          .in("id", issuanceInstanceIds);

        const { data: useForms } = await supabase
          .from("card_forms")
          .select("id")
          .eq("form_type", "use");

        const useFormIds = new Set((useForms || []).map((f) => f.id));

        // For each data room, check which Use CARDs reference it
        instances.forEach((inst) => {
          const p = inst.payload as any;
          const dataTitle = p?.card?.title || "";
          const resourceDN = p?.claims?.items?.[0]?.resource?.display_name || "";
          const resourceUri = p?.claims?.items?.[0]?.resource?.uri || "";
          let count = 0;

          (useInstances || []).forEach((ui: any) => {
            if (!useFormIds.has(ui.form_id)) return;
            const claims = ui.payload?.claims?.items || [];
            const refs = claims.some((c: any) => {
              const dn = c.resource?.display_name || "";
              const uri = c.resource?.uri || "";
              return (
                (dn && (dn === dataTitle || dn === resourceDN)) ||
                (uri && uri === resourceUri)
              );
            });
            if (refs) count++;
          });

          countMap[inst.id] = count;
        });
      }

      setRooms(
        instances.map((inst) => ({
          id: inst.id,
          payload: inst.payload,
          created_at: inst.created_at,
          accessCount: countMap[inst.id] || 0,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Data Rooms</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The data resources protected by your front door.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No data resources registered yet. Your front door is active but nothing is behind it.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rooms.map((room) => {
            const p = room.payload as any;
            const title = p?.card?.title || "Untitled resource";
            const claim = p?.claims?.items?.[0];
            const sensitivity = claim?.sensitivity?.level;
            const resourceName = extractResourceName(claim);
            const actions = formatActions(claim?.constraints?.allowed_actions);
            const purposeLabel = claim?.constraints?.purpose?.[0]?.label;
            const agentWord = room.accessCount === 1 ? "agent" : "agents";

            return (
              <Card
                key={room.id}
                className="border-l-4 border-l-vault-green overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelected(room)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-base leading-tight">
                      {title}
                    </span>
                    <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>

                  {sensitivity === "high" && (
                    <Badge variant="destructive" className="text-xs">
                      🔴 HIGH SENSITIVITY
                    </Badge>
                  )}

                  <p className="text-sm text-muted-foreground truncate">
                    {resourceName}
                  </p>

                  {actions && (
                    <p className="text-xs text-muted-foreground/80">
                      {actions}
                    </p>
                  )}

                  {purposeLabel && (
                    <p className="text-xs text-muted-foreground/80">
                      Purpose: {purposeLabel}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground/70">
                    <span>Protected since {formatDate(room.created_at)}</span>
                    <Badge variant="outline" className="text-xs">
                      {room.accessCount} {agentWord}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DataRoomDetailPanel
        open={!!selected}
        onClose={() => setSelected(null)}
        room={selected}
      />
    </div>
  );
}
