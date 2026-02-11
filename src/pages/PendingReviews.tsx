import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "@/components/CopyIdButton";
import { useCopyToast } from "@/components/CopyToast";
import { ResultPanel } from "@/components/ResultPanel";
import { CardContentRenderer } from "@/components/CardContentRenderer";
import { CardTypeBadge } from "@/components/CardTypeBadge";

interface Delivery {
  id: string;
  issuance_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface IssuedCard {
  issuance_id: string;
  instance_id: string;
  form_id: string;
  form_type: string;
  form_name: string;
  payload: any;
  status: string;
  issued_at: string;
}

interface Resolution {
  issuanceId: string;
  resolution: "accepted" | "rejected";
}

export default function PendingReviews() {
  const { copyToast } = useCopyToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [issuedCards, setIssuedCards] = useState<Record<string, IssuedCard>>({});
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [lastResolution, setLastResolution] = useState<Resolution | null>(null);

  const fetchDeliveries = async () => {
    const { data, error } = await (supabase as any)
      .from("card_deliveries")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const all = data as Delivery[];
      setDeliveries(all);

      // Fetch full CARD details for pending deliveries
      const pending = all.filter((d) => d.status === "pending");
      const details: Record<string, IssuedCard> = {};

      await Promise.all(
        pending.map(async (del) => {
          try {
            const { data: detail } = await supabase.rpc("get_issued_card_instance", {
              p_issuance_id: del.issuance_id,
            });
            if (detail && detail.length > 0) {
              details[del.issuance_id] = detail[0] as unknown as IssuedCard;
            }
          } catch {
            // silently skip if RPC fails
          }
        })
      );

      setIssuedCards(details);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const handleResolve = async (issuanceId: string, resolution: "accepted" | "rejected") => {
    setResolving(issuanceId);
    setLastResolution(null);

    try {
      const { error } = await (supabase.rpc as any)("resolve_card_issuance", {
        p_issuance_id: issuanceId,
        p_resolution: resolution,
      });
      if (error) throw error;

      setLastResolution({ issuanceId, resolution });
      copyToast({
        title: resolution === "accepted" ? "CARD accepted" : "CARD rejected",
        id: issuanceId,
        label: "Issuance ID",
      });

      // Remove from pending list immediately
      setDeliveries((prev) => prev.filter((d) => d.issuance_id !== issuanceId));
      setIssuedCards((prev) => {
        const next = { ...prev };
        delete next[issuanceId];
        return next;
      });
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const pendingDeliveries = deliveries.filter((d) => d.status === "pending");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Pending Reviews</h1>

      {/* ── Post-resolution confirmation ── */}
      {lastResolution && (
        <div className="mb-6">
          <ResultPanel
            title={lastResolution.resolution === "accepted" ? "CARD Accepted" : "CARD Rejected"}
            entries={[{ label: "Issuance ID", value: lastResolution.issuanceId }]}
          />
          <p className="text-sm text-muted-foreground mt-2 px-1">
            {lastResolution.resolution === "accepted"
              ? "The issuer can now see that you have accepted this CARD."
              : "The issuer will be notified that you declined this CARD."}
          </p>
          <Button asChild variant="link" size="sm" className="px-1 mt-1">
            <Link to={`/audit?entityType=card_issuance&entityId=${lastResolution.issuanceId}`}>
              View audit trail →
            </Link>
          </Button>
        </div>
      )}

      {/* ── Loading / Empty ── */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : pendingDeliveries.length === 0 && !lastResolution ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No pending CARD reviews. You're all caught up.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingDeliveries.map((del) => {
            const detail = issuedCards[del.issuance_id];

            return (
              <Card key={del.id} className="overflow-hidden">
                <CardContent className="p-5 space-y-5">
                  {detail ? (
                    <>
                      <CardContentRenderer
                        payload={detail.payload}
                        formType={detail.form_type}
                        formName={detail.form_name}
                        issuedAt={detail.issued_at}
                      />

                      {/* IDs */}
                      <div className="flex flex-wrap gap-4 pt-2 border-t">
                        <CopyIdButton value={del.issuance_id} label="Issuance ID" variant="inline" className="text-muted-foreground/70" />
                        <CopyIdButton value={del.id} label="Delivery ID" variant="inline" className="text-muted-foreground/70" />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3 pt-1">
                        <Button
                          onClick={() => handleResolve(del.issuance_id, "accepted")}
                          disabled={resolving === del.issuance_id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {resolving === del.issuance_id ? "Processing…" : "Accept CARD"}
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleResolve(del.issuance_id, "rejected")}
                          disabled={resolving === del.issuance_id}
                        >
                          Reject CARD
                        </Button>
                      </div>
                    </>
                  ) : (
                    /* Fallback if RPC failed */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">pending</Badge>
                        <span className="text-sm text-muted-foreground">
                          Received {new Date(del.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      <CopyIdButton value={del.issuance_id} label="Issuance ID" variant="inline" />
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleResolve(del.issuance_id, "accepted")}
                          disabled={resolving === del.issuance_id}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Accept
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleResolve(del.issuance_id, "rejected")}
                          disabled={resolving === del.issuance_id}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
