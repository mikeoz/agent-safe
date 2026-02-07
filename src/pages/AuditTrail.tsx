import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  lifecycle_context: any;
  created_at: string;
}

export default function AuditTrail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entityType, setEntityType] = useState(searchParams.get("entityType") || "card_form");
  const [entityId, setEntityId] = useState(searchParams.get("entityId") || "");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchTrail = async () => {
    if (!entityId.trim()) return;
    setLoading(true);
    setFetched(true);

    const { data, error } = await supabase.rpc("get_audit_trail", {
      p_entity_type: entityType,
      p_entity_id: entityId.trim(),
    });

    if (!error && data) {
      setEntries(data as AuditEntry[]);
    } else {
      setEntries([]);
    }
    setLoading(false);
  };

  // Auto-fetch if params provided
  useEffect(() => {
    if (searchParams.get("entityId")) {
      fetchTrail();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ entityType, entityId });
    fetchTrail();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Audit Trail</h1>

      <form onSubmit={handleSubmit} className="flex items-end gap-4 mb-6">
        <div className="space-y-2">
          <Label>Entity Type</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="card_form">card_form</SelectItem>
              <SelectItem value="card_instance">card_instance</SelectItem>
              <SelectItem value="card_issuance">card_issuance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 flex-1">
          <Label htmlFor="entityId">Entity ID</Label>
          <Input
            id="entityId"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="UUID"
            className="font-mono text-sm"
          />
        </div>
        <Button type="submit" disabled={loading || !entityId.trim()}>
          {loading ? "Loading…" : "Fetch"}
        </Button>
      </form>

      {fetched && !loading && entries.length === 0 && (
        <p className="text-muted-foreground text-sm">No audit entries found (or not authorized).</p>
      )}

      {entries.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Context</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <Badge variant="outline">{entry.action}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {entry.actor_id ? entry.actor_id.slice(0, 8) + "…" : "system"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <pre className="text-xs font-mono max-w-[300px] whitespace-pre-wrap">
                    {entry.lifecycle_context
                      ? JSON.stringify(entry.lifecycle_context, null, 2)
                      : "—"}
                  </pre>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
