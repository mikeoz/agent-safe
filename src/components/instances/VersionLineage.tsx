import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CopyIdButton } from "@/components/CopyIdButton";
import { ChevronDown, ChevronRight, History } from "lucide-react";

interface LineageEntry {
  instance_id: string;
  form_id: string;
  payload: any;
  is_current: boolean;
  superseded_by: string | null;
  superseded_at: string | null;
  created_at: string;
  version_number: number;
}

interface VersionLineageProps {
  instanceId: string;
}

export function VersionLineage({ instanceId }: VersionLineageProps) {
  const [expanded, setExpanded] = useState(false);
  const [lineage, setLineage] = useState<LineageEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadLineage = async () => {
    if (lineage) {
      setExpanded(!expanded);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_card_lineage", {
        p_instance_id: instanceId,
      });
      if (!error && data) {
        setLineage(data as unknown as LineageEntry[]);
        setExpanded(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const pastVersions = lineage?.filter((v) => !v.is_current) || [];

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={loadLineage}
        className="gap-1.5 text-muted-foreground text-xs h-7 px-2"
      >
        <History className="h-3.5 w-3.5" />
        Version history
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </Button>

      {loading && <p className="text-xs text-muted-foreground pl-2 pt-1">Loading…</p>}

      {expanded && pastVersions.length > 0 && (
        <div className="mt-2 ml-2 border-l-2 border-muted pl-3 space-y-2">
          {pastVersions.map((v) => (
            <div key={v.instance_id} className="text-xs text-muted-foreground/70 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">v{v.version_number}</span>
                <span>{v.payload?.card?.title || "Untitled"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>
                  Superseded{" "}
                  {v.superseded_at
                    ? new Date(v.superseded_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </span>
                <CopyIdButton value={v.instance_id} label="ID" variant="inline" className="text-muted-foreground/50" />
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && pastVersions.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground/60 pl-2 pt-1">No previous versions.</p>
      )}
    </div>
  );
}
