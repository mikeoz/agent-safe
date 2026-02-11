import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { useCopyToast } from "@/components/CopyToast";

interface Delivery {
  id: string;
  issuance_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InstanceDetail {
  instance_id: string;
  form_id: string;
  form_name: string;
  form_type: string;
  issuance_id: string;
  issued_at: string;
  payload: any;
  status: string;
}

export default function PendingReviews() {
  const { copyToast } = useCopyToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [instanceDetails, setInstanceDetails] = useState<Record<string, InstanceDetail>>({});
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchDeliveries = async () => {
    // Fetch deliveries where I'm the recipient
    const { data, error } = await (supabase as any)
      .from("card_deliveries")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const deliveryData = data as Delivery[];
      setDeliveries(deliveryData);
      // Fetch instance details for pending/accepted deliveries via RPC
      for (const del of deliveryData) {
        if (del.status === "pending" || del.status === "accepted") {
          const { data: detail } = await supabase.rpc("get_issued_card_instance", {
            p_issuance_id: del.issuance_id,
          });
          if (detail && detail.length > 0) {
            setInstanceDetails((prev) => ({ ...prev, [del.issuance_id]: detail[0] }));
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleResolve = async (issuanceId: string, resolution: "accepted" | "rejected") => {
    setResolving(issuanceId);
    try {
      const { error } = await (supabase.rpc as any)("resolve_card_issuance", {
        p_issuance_id: issuanceId,
        p_resolution: resolution,
      });

      if (error) throw error;

      copyToast({
        title: resolution === "accepted" ? "Card accepted" : "Card rejected",
        id: issuanceId,
        label: "Issuance ID",
      });
      fetchDeliveries();
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Pending Reviews</h1>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : deliveries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No deliveries to review.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delivery ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issuance</TableHead>
              <TableHead>Received</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((del) => {
              const detail = instanceDetails[del.issuance_id];
              return (
                <TableRow key={del.id}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{del.id.slice(0, 8)}…</span>
                      <CopyIdButton value={del.id} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        del.status === "accepted"
                          ? "default"
                          : del.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {del.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs">{del.issuance_id.slice(0, 8)}…</span>
                      <CopyIdButton value={del.issuance_id} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(del.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {detail ? (
                      <pre className="text-xs font-mono max-w-[200px] truncate">
                        {JSON.stringify(detail.payload)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {del.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleResolve(del.issuance_id, "accepted")}
                            disabled={resolving === del.issuance_id}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleResolve(del.issuance_id, "rejected")}
                            disabled={resolving === del.issuance_id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/audit?entityType=card_issuance&entityId=${del.issuance_id}`}>
                          Audit
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
