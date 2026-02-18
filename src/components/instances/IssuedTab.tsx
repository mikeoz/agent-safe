import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CopyIdButton } from "@/components/CopyIdButton";
import { RevokeDialog } from "./RevokeDialog";

interface Issuance {
  id: string;
  instance_id: string;
  status: string;
  issued_at: string;
  resolved_at: string | null;
  recipient_member_id: string | null;
  invitee_locator: string | null;
}

export function IssuedTab() {
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<Issuance | null>(null);

  const fetchIssuances = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("card_issuances")
      .select("*")
      .eq("issuer_id", user.id)
      .order("issued_at", { ascending: false });

    if (!error && data) setIssuances(data as unknown as Issuance[]);
    setLoading(false);
  };

  useEffect(() => { fetchIssuances(); }, []);

  const recipientLabel = (i: Issuance) =>
    i.recipient_member_id
      ? i.recipient_member_id.slice(0, 8) + "…"
      : i.invitee_locator || "Unknown";

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
      issued: { variant: "secondary" },
      accepted: { variant: "default", className: "bg-green-600 hover:bg-green-600/80" },
      rejected: { variant: "destructive" },
      revoked: { variant: "outline", className: "text-muted-foreground border-muted-foreground/40" },
    };
    const cfg = map[status] || { variant: "secondary" as const };
    return <Badge variant={cfg.variant} className={cfg.className}>{status}</Badge>;
  };

  const canRevoke = (status: string) => status === "issued" || status === "accepted";

  if (loading) return <p className="text-muted-foreground text-sm">Loading…</p>;
  if (issuances.length === 0) return <p className="text-muted-foreground text-sm">No CARDs issued yet.</p>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issuances.map((i) => (
            <TableRow key={i.id}>
              <TableCell>
                <div className="flex items-center gap-1">
                  <span className="text-sm">
                    {i.recipient_member_id
                      ? <span className="font-mono text-xs">{i.recipient_member_id.slice(0, 8)}…</span>
                      : <span className="text-xs">{i.invitee_locator}</span>}
                  </span>
                  {i.recipient_member_id && <CopyIdButton value={i.recipient_member_id} />}
                </div>
              </TableCell>
              <TableCell>{statusBadge(i.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(i.issued_at).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {canRevoke(i.status) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRevokeTarget(i)}
                    >
                      Revoke
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/audit?entityType=card_issuance&entityId=${i.id}`}>Audit</Link>
                  </Button>
                  <CopyIdButton value={i.id} label="Issuance" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <RevokeDialog
        issuanceId={revokeTarget?.id || null}
        recipientLabel={revokeTarget ? recipientLabel(revokeTarget) : ""}
        onClose={() => setRevokeTarget(null)}
        onSuccess={fetchIssuances}
      />
    </>
  );
}
