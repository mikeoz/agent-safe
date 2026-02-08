import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CopyIdButtonProps {
  value: string;
  label?: string;
  variant?: "inline" | "icon";
  className?: string;
}

export function CopyIdButton({ value, label, variant = "icon", className }: CopyIdButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs", className)}>
        {label && <span className="text-muted-foreground">{label}:</span>}
        <span className="select-all">{value}</span>
        <button
          onClick={handleCopy}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </button>
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-6 w-6", className)}
      onClick={handleCopy}
      title="Copy ID to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}
