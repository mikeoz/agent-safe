import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

/**
 * Returns a toast helper that adds a "Copy" action when an ID is provided.
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

    toast({
      title,
      description: `${label || "ID"}: ${id}`,
      variant,
      action: (
        <ToastAction
          altText="Copy ID"
          onClick={() => navigator.clipboard.writeText(id)}
        >
          Copy
        </ToastAction>
      ),
    });
  };

  return { copyToast };
}
