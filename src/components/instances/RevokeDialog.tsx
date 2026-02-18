import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCopyToast } from "@/components/CopyToast";

interface RevokeDialogProps {
  issuanceId: string | null;
  recipientLabel: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RevokeDialog({
  issuanceId,
  recipientLabel,
  onClose,
  onSuccess,
}: RevokeDialogProps) {
  const { copyToast } = useCopyToast();
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async () => {
    if (!issuanceId) return;
    setRevoking(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc("revoke_card_issuance", {
        p_issuance_id: issuanceId,
      });
      if (rpcError) throw rpcError;

      copyToast({ title: "Access revoked successfully" });
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      if (msg.includes("NOT_ISSUER")) {
        setError("You are not authorized to revoke this CARD");
      } else if (msg.includes("INVALID_STATUS") || msg.includes("already")) {
        setError("This CARD has already been revoked or rejected");
      } else {
        setError(msg);
      }
    } finally {
      setRevoking(false);
    }
  };

  return (
    <AlertDialog open={!!issuanceId} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke Access</AlertDialogTitle>
          <AlertDialogDescription>
            Revoke access for <strong>{recipientLabel}</strong>? This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleRevoke}
            disabled={revoking}
          >
            {revoking ? "Revoking…" : "Revoke Access"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
