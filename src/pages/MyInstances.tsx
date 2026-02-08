import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyIdButton } from "@/components/CopyIdButton";
import { useCopyToast } from "@/components/CopyToast";

interface CardInstance {
  id: string;
  form_id: string;
  payload: any;
  created_at: string;
  card_forms?: { name: string; form_type: string } | null;
}

interface Delivery {
  id: string;
  issuance_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

type RecipientMode = "member" | "invitee";

export default function MyInstances() {
  const { copyToast } = useCopyToast();
  const [instances, setInstances] = useState<CardInstance[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);

  // Issue dialog state
  const [issueTarget, setIssueTarget] = useState<CardInstance | null>(null);
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("member");
  const [recipientId, setRecipientId] = useState("");
  const [inviteeLocator, setInviteeLocator] = useState("");
  const [issuing, setIssuing] = useState(false);

  const fetchInstances = async () => {
    const { data, error } = await supabase
      .from("card_instances")
      .select("*, card_forms(name, form_type)")
      .order("created_at", { ascending: false });
    if (!error && data) setInstances(data);
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

  const resetIssueDialog = () => {
    setIssueTarget(null);
    setRecipientMode("member");
    setRecipientId("");
    setInviteeLocator("");
  };

  const handleIssue = async () => {
    if (!issueTarget) return;

    const hasMember = recipientMode === "member" && recipientId.trim();
    const hasInvitee = recipientMode === "invitee" && inviteeLocator.trim();

    if (!hasMember && !hasInvitee) return;

    setIssuing(true);

    try {
      const params: Record<string, string | undefined> = {
        p_instance_id: issueTarget.id,
      };

      if (recipientMode === "member") {
        params.p_recipient_member_id = recipientId.trim();
      } else {
        params.p_invitee_locator = inviteeLocator.trim();
      }

      const { data, error } = await (supabase.rpc as any)("issue_card", params);

      if (error) throw error;

      // RPC now returns TABLE rows
      const result = Array.isArray(data) ? data[0] : data;

      copyToast({
        title: "Card issued",
        id: result?.issuance_id,
        label: "Issuance ID",
      });
      resetIssueDialog();
      fetchDeliveries();
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  const isIssueDisabled = () => {
    if (issuing) return true;
    if (recipientMode === "member") return !recipientId.trim();
    return !inviteeLocator.trim();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">My Instances</h1>
        <Button asChild size="sm">
          <Link to="/instances/create">Create Instance</Link>
        </Button>
      </div>

      <Tabs defaultValue="created">
        <TabsList>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="received">Received</TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-4">
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
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{inst.id.slice(0, 8)}…</span>
                        <CopyIdButton value={inst.id} />
                      </div>
                    </TableCell>
                    <TableCell>
                      {inst.card_forms
                        ? `${inst.card_forms.name} (${inst.card_forms.form_type})`
                        : inst.form_id.slice(0, 8)}
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
        </TabsContent>

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
                      <Badge
                        variant={
                          d.status === "accepted"
                            ? "default"
                            : d.status === "rejected"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/audit?entityType=card_issuance&entityId=${d.issuance_id}`}>
                          Audit
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!issueTarget} onOpenChange={(open) => !open && resetIssueDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue CARD Instance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Instance: <span className="font-mono">{issueTarget?.id.slice(0, 8)}…</span>
            </p>
            <div className="space-y-2">
              <Label>Recipient Type</Label>
              <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as RecipientMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member (by ID)</SelectItem>
                  <SelectItem value="invitee">Invitee (by locator)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recipientMode === "member" ? (
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="inviteeLocator">Invitee Locator</Label>
                <Input
                  id="inviteeLocator"
                  value={inviteeLocator}
                  onChange={(e) => setInviteeLocator(e.target.value)}
                  placeholder="e.g. email or external identifier"
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetIssueDialog}>
              Cancel
            </Button>
            <Button onClick={handleIssue} disabled={isIssueDisabled()}>
              {issuing ? "Issuing…" : "Issue Card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
