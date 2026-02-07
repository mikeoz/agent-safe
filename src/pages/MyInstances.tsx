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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CardInstance {
  id: string;
  form_id: string;
  payload: any;
  created_at: string;
  card_forms?: { name: string; form_type: string } | null;
}

export default function MyInstances() {
  const { toast } = useToast();
  const [instances, setInstances] = useState<CardInstance[]>([]);
  const [loading, setLoading] = useState(true);

  // Issue dialog state
  const [issueTarget, setIssueTarget] = useState<CardInstance | null>(null);
  const [recipientId, setRecipientId] = useState("");
  const [issuing, setIssuing] = useState(false);

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from("card_instances")
      .select("*, card_forms(name, form_type)")
      .order("created_at", { ascending: false });
    if (!error && data) setInstances(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleIssue = async () => {
    if (!issueTarget || !recipientId.trim()) return;
    setIssuing(true);

    try {
      const { data, error } = await (supabase.rpc as any)("issue_card", {
        p_instance_id: issueTarget.id,
        p_recipient_member_id: recipientId.trim(),
      });

      if (error) throw error;

      toast({ title: "Card issued", description: `Issuance ID: ${data}` });
      setIssueTarget(null);
      setRecipientId("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">My Instances</h1>
        <Button asChild size="sm">
          <Link to="/instances/create">Create Instance</Link>
        </Button>
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : instances.length === 0 ? (
        <p className="text-muted-foreground text-sm">No instances yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instance ID</TableHead>
              <TableHead>Form</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((inst) => (
              <TableRow key={inst.id}>
                <TableCell className="font-mono text-xs">{inst.id.slice(0, 8)}…</TableCell>
                <TableCell>
                  {inst.card_forms ? `${inst.card_forms.name} (${inst.card_forms.form_type})` : inst.form_id.slice(0, 8)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inst.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIssueTarget(inst)}>
                      Issue
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/audit?entityType=card_instance&entityId=${inst.id}`}>Audit</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!issueTarget} onOpenChange={(open) => !open && setIssueTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue CARD Instance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Instance: <span className="font-mono">{issueTarget?.id.slice(0, 8)}…</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="recipientId">Recipient Member ID (UUID)</Label>
              <Input
                id="recipientId"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Enter recipient's user ID"
                className="font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleIssue} disabled={issuing || !recipientId.trim()}>
              {issuing ? "Issuing…" : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
