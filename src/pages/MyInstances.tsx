import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyIdButton } from "@/components/CopyIdButton";
import { ResultPanel } from "@/components/ResultPanel";
import { InstanceCard, type CardInstanceItem } from "@/components/instances/InstanceCard";
import { IssueDialog } from "@/components/instances/IssueDialog";

interface Delivery {
  id: string;
  issuance_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function MyInstances() {
  const [instances, setInstances] = useState<CardInstanceItem[]>([]);
  const [versionNumbers, setVersionNumbers] = useState<Record<string, number>>({});
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [issueTargetId, setIssueTargetId] = useState<string | null>(null);
  const [lastIssuance, setLastIssuance] = useState<{ issuanceId: string; deliveryId: string } | null>(null);

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from("card_instances")
      .select("*, card_forms(name, form_type)")
      .eq("is_current", true)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const items = data as unknown as CardInstanceItem[];
      setInstances(items);

      // Fetch version numbers for instances that have been superseded into
      // We check which ones have a superseded predecessor by calling lineage lazily
      // But we can detect multi-version by checking if any other instance points to this one
      // For efficiency, query instances that have superseded_by set pointing to our current IDs
      const currentIds = items.map((i) => i.id);
      if (currentIds.length > 0) {
        const { data: predecessors } = await supabase
          .from("card_instances")
          .select("superseded_by")
          .in("superseded_by", currentIds);

        if (predecessors && predecessors.length > 0) {
          // For those that have predecessors, fetch lineage to get version numbers
          const idsWithHistory = new Set(predecessors.map((p) => p.superseded_by).filter(Boolean));
          const versionMap: Record<string, number> = {};

          await Promise.all(
            Array.from(idsWithHistory).map(async (id) => {
              try {
                const { data: lineage } = await supabase.rpc("get_card_lineage", {
                  p_instance_id: id as string,
                });
                if (lineage) {
                  const current = (lineage as any[]).find((v) => v.is_current);
                  if (current) {
                    versionMap[id as string] = current.version_number;
                  }
                }
              } catch {
                // skip
              }
            })
          );

          setVersionNumbers(versionMap);
        }
      }
    }
    setLoading(false);
  };

  const fetchDeliveries = async () => {
    const { data, error } = await (supabase as any)
      .from("card_deliveries")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setDeliveries(data as Delivery[]);
    setDeliveriesLoading(false);
  };

  useEffect(() => {
    fetchInstances();
    fetchDeliveries();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">My Instances</h1>
        <Button asChild size="sm">
          <Link to="/instances/create">Create CARD</Link>
        </Button>
      </div>

      <Tabs defaultValue="created">
        <TabsList>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>

        {/* ── Created Tab ── */}
        <TabsContent value="created" className="mt-4">
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : instances.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">No CARD instances created yet. Create your first CARD to get started.</p>
              <Button asChild>
                <Link to="/instances/create">Create CARD</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {instances.map((inst) => (
                <InstanceCard
                  key={inst.id}
                  instance={inst}
                  versionNumber={versionNumbers[inst.id] ?? null}
                  onIssue={(i) => setIssueTargetId(i.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Received Tab ── */}
        <TabsContent value="received" className="mt-4">
          {deliveriesLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-muted-foreground text-sm">No received deliveries.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Delivery ID</TableHead>
                  <TableHead>Issuance ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{d.id.slice(0, 8)}…</span>
                        <CopyIdButton value={d.id} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{d.issuance_id.slice(0, 8)}…</span>
                        <CopyIdButton value={d.issuance_id} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.status === "accepted" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/audit?entityType=card_issuance&entityId=${d.issuance_id}`}>Audit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {lastIssuance && (
        <ResultPanel
          title="Card Issued"
          entries={[
            { label: "Issuance ID", value: lastIssuance.issuanceId },
            { label: "Delivery ID", value: lastIssuance.deliveryId },
          ]}
        />
      )}

      <IssueDialog
        instanceId={issueTargetId}
        onClose={() => setIssueTargetId(null)}
        onSuccess={(issuanceId, deliveryId) => {
          setLastIssuance({ issuanceId, deliveryId });
          fetchDeliveries();
        }}
      />
    </div>
  );
}
