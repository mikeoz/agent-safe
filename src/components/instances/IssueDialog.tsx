import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCopyToast } from "@/components/CopyToast";

type RecipientMode = "member" | "invitee";

interface IssueDialogProps {
  instanceId: string | null;
  onClose: () => void;
  onSuccess: (issuanceId: string, deliveryId: string) => void;
}

export function IssueDialog({ instanceId, onClose, onSuccess }: IssueDialogProps) {
  const { copyToast } = useCopyToast();
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("member");
  const [recipientId, setRecipientId] = useState("");
  const [inviteeLocator, setInviteeLocator] = useState("");
  const [issuing, setIssuing] = useState(false);

  const reset = () => {
    setRecipientMode("member");
    setRecipientId("");
    setInviteeLocator("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleIssue = async () => {
    if (!instanceId) return;
    const hasMember = recipientMode === "member" && recipientId.trim();
    const hasInvitee = recipientMode === "invitee" && inviteeLocator.trim();
    if (!hasMember && !hasInvitee) return;

    setIssuing(true);
    try {
      const params: Record<string, string | undefined> = { p_instance_id: instanceId };
      if (recipientMode === "member") {
        params.p_recipient_id = recipientId.trim();
      } else {
        params.p_invitee_locator = inviteeLocator.trim();
      }

      const { data, error } = await (supabase.rpc as any)("issue_card", params);
      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      copyToast({ title: "Card issued", id: result?.issuance_id, label: "Issuance ID" });
      onSuccess(result?.issuance_id, result?.delivery_id);
      handleClose();
    } catch (err: any) {
      copyToast({ title: "Error: " + err.message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  const isDisabled = issuing || (recipientMode === "member" ? !recipientId.trim() : !inviteeLocator.trim());

  return (
    <Dialog open={!!instanceId} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue CARD Instance</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Instance: <span className="font-mono">{instanceId?.slice(0, 8)}…</span>
          </p>
          <div className="space-y-2">
            <Label>Recipient Type</Label>
            <Select value={recipientMode} onValueChange={(v) => setRecipientMode(v as RecipientMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member (by ID)</SelectItem>
                <SelectItem value="invitee">Invitee (by locator)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {recipientMode === "member" ? (
            <div className="space-y-2">
              <Label htmlFor="recipientId">Recipient Member ID (UUID)</Label>
              <Input id="recipientId" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} placeholder="Enter recipient's user ID" className="font-mono text-sm" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="inviteeLocator">Invitee Locator</Label>
              <Input id="inviteeLocator" value={inviteeLocator} onChange={(e) => setInviteeLocator(e.target.value)} placeholder="e.g. email or external identifier" className="font-mono text-sm" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleIssue} disabled={isDisabled}>{issuing ? "Issuing…" : "Issue Card"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
