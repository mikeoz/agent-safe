import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Issuance {
  id: string;
  instance_id: string;
  issuer_id: string;
  status: string;
  issued_at: string;
  resolved_at: string | null;
}

interface InstanceDetail {
  instance_id: string;
  form_id: string;
  payload: any;
  created_at: string;
}

export default function PendingReviews() {
  const { toast } = useToast();
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [instanceDetails, setInstanceDetails] = useState<Record<string, InstanceDetail>>({});
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchIssuances = async () => {
    const { data, error } = await supabase
      .from("card_issuances")
      .select("*")
      .order("issued_at", { ascending: false });

    if (!error && data) {
      setIssuances(data);
      // Fetch instance details for issued/accepted ones via RPC
      for (const iss of data) {
        if (iss.status === "issued" || iss.status === "accepted") {
          const { data: detail } = await supabase.rpc("get_issued_card_instance", {
            p_issuance_id: iss.id,
          });
          if (detail && detail.length > 0) {
            setInstanceDetails((prev) => ({ ...prev, [iss.id]: detail[0] }));
          }
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchIssuances();
  }, []);

  const handleResolve = async (issuanceId: string, resolution: "accepted" | "rejected") => {
    setResolving(issuanceId);
    try {
      const { error } = await (supabase.rpc as any)("resolve_card_issuance", {
        p_issuance_id: issuanceId,
        p_resolution: resolution,
      });

      if (error) throw error;

      toast({ title: resolution === "accepted" ? "Card accepted" : "Card rejected" });
      fetchIssuances();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Pending Reviews</h1>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : issuances.length === 0 ? (
        <p className="text-muted-foreground text-sm">No issuances to review.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Issuance ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Payload</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {issuances.map((iss) => {
              const detail = instanceDetails[iss.id];
              return (
                <TableRow key={iss.id}>
                  <TableCell className="font-mono text-xs">{iss.id.slice(0, 8)}…</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        iss.status === "accepted"
                          ? "default"
                          : iss.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {iss.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{iss.issuer_id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(iss.issued_at).toLocaleString()}
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
                      {iss.status === "issued" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleResolve(iss.id, "accepted")}
                            disabled={resolving === iss.id}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleResolve(iss.id, "rejected")}
                            disabled={resolving === iss.id}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/audit?entityType=card_issuance&entityId=${iss.id}`}>
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
