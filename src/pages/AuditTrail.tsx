import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditTimeline } from "@/components/audit/AuditTimeline";

interface AuditEntry {
  id: string;
  action: string;
  actor_id?: string | null;
  entity_type: string;
  entity_id: string;
  lifecycle_context: any;
  created_at: string;
}

export default function AuditTrail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || (searchParams.get("entityId") ? "entity" : "my-recent");
  const [tab, setTab] = useState(initialTab);

  // Entity lookup
  const [entityType, setEntityType] = useState(searchParams.get("entityType") || "card_instance");
  const [entityId, setEntityId] = useState(searchParams.get("entityId") || "");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // My recent
  const [myEntries, setMyEntries] = useState<AuditEntry[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myFetched, setMyFetched] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);

  const fetchTrail = async () => {
    if (!entityId.trim()) return;
    setLoading(true);
    setFetched(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("get_audit_trail", {
      p_entity_type: entityType,
      p_entity_id: entityId.trim(),
    });

    if (rpcError) {
      setError(rpcError.message);
      setEntries([]);
    } else {
      setEntries((data as AuditEntry[]) || []);
    }
    setLoading(false);
  };

  const fetchMyRecent = async () => {
    setMyLoading(true);
    setMyFetched(true);
    setMyError(null);

    const { data, error: rpcError } = await (supabase.rpc as any)("get_my_recent_audit", {
      p_limit: 50,
    });

    if (rpcError) {
      setMyError(rpcError.message);
      setMyEntries([]);
    } else {
      setMyEntries((data as AuditEntry[]) || []);
    }
    setMyLoading(false);
  };

  // Auto-fetch entity trail if params present, or auto-load my-recent
  useEffect(() => {
    if (searchParams.get("entityId")) {
      fetchTrail();
    } else {
      fetchMyRecent();
    }
  }, []);

  const handleEntitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ tab: "entity", entityType, entityId });
    fetchTrail();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Audit Trail</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="my-recent">My Activity</TabsTrigger>
          <TabsTrigger value="entity">CARD History</TabsTrigger>
        </TabsList>

        <TabsContent value="my-recent" className="mt-4">
          <div className="mb-4">
            <Button onClick={fetchMyRecent} disabled={myLoading} variant="outline" size="sm">
              {myLoading ? "Loading…" : myFetched ? "Refresh" : "Load My Activity"}
            </Button>
          </div>

          {myError && (
            <p className="text-sm text-destructive mb-4">{myError}</p>
          )}

          <AuditTimeline entries={myEntries} />
        </TabsContent>

        <TabsContent value="entity" className="mt-4">
          <form onSubmit={handleEntitySubmit} className="flex items-end gap-4 mb-6">
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card_form">CARD Form</SelectItem>
                  <SelectItem value="card_instance">CARD Instance</SelectItem>
                  <SelectItem value="card_issuance">CARD Issuance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1">
              <Label htmlFor="entityId">Entity ID</Label>
              <Input
                id="entityId"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Paste a CARD ID here"
                className="font-mono text-sm"
              />
            </div>
            <Button type="submit" disabled={loading || !entityId.trim()}>
              {loading ? "Loading…" : "Fetch"}
            </Button>
          </form>

          {error && (
            <p className="text-sm text-destructive mb-4">{error}</p>
          )}

          {fetched && !loading && (
            <AuditTimeline
              entries={entries}
              emptyMessage="No audit entries found for this entity (or not authorized)."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
