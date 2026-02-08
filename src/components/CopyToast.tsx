import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { PROOF_MODE } from "@/lib/proofMode";

/**
 * Returns a toast helper that adds a "Copy" action when an ID is provided.
 * In Proof Mode, all toasts persist and ID toasts show Copy + Dismiss.
 */
export function useCopyToast() {
  const { toast } = useToast();

  const copyToast = ({
    title,
    id,
    label,
    variant,
  }: {
    title: string;
    id?: string;
    label?: string;
    variant?: "default" | "destructive";
  }) => {
    if (!id) {
      toast({ title, variant });
      return;
    }

    const { dismiss } = toast({
      title,
      description: `${label || "ID"}: ${id}`,
      variant,
      action: (
        <div className="flex gap-2">
          <ToastAction
            altText="Copy ID"
            onClick={() => navigator.clipboard.writeText(id)}
          >
            Copy
          </ToastAction>
          {PROOF_MODE && (
            <ToastAction altText="Dismiss" onClick={() => dismiss()}>
              Dismiss
            </ToastAction>
          )}
        </div>
      ),
    });
  };

  return { copyToast };
}
