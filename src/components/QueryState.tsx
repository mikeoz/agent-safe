import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface QueryStateProps {
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
  /** Optional: custom loading text */
  loadingText?: string;
}

export function QueryState({
  loading,
  error,
  onRetry,
  isEmpty,
  emptyMessage,
  children,
  loadingText = "Loading…",
}: QueryStateProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">{loadingText}</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <AlertDescription>Something went wrong. Please try again.</AlertDescription>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 ml-4">
            Retry
          </Button>
        )}
      </Alert>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
