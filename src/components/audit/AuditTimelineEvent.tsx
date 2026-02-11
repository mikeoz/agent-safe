import { useState } from "react";
import { CopyIdButton } from "@/components/CopyIdButton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_META: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  form_registered: {
    icon: "📋",
    label: "A new CARD form was registered",
    color: "border-primary/50 bg-primary/5",
  },
  instance_created: {
    icon: "✨",
    label: "A CARD instance was created",
    color: "border-primary/50 bg-primary/5",
  },
  card_issued: {
    icon: "📤",
    label: "A CARD was issued to a recipient",
    color: "border-primary/50 bg-primary/5",
  },
  card_accepted: {
    icon: "✅",
    label: "The recipient accepted this CARD",
    color: "border-green-500/40 bg-green-50",
  },
  card_rejected: {
    icon: "❌",
    label: "The recipient declined this CARD",
    color: "border-destructive/40 bg-destructive/5",
  },
  card_superseded: {
    icon: "🔄",
    label: "This CARD was revised — a new version was created",
    color: "border-amber-500/40 bg-amber-50",
  },
  card_revoked: {
    icon: "🚫",
    label: "Access to this CARD was revoked",
    color: "border-destructive/40 bg-destructive/5",
  },
  instance_create_blocked_unregistered_form: {
    icon: "⛔",
    label: "A CARD creation was blocked — form was not registered",
    color: "border-orange-500/40 bg-orange-50",
  },
};

const CONTEXT_LABELS: Record<string, string> = {
  form_id: "Form ID",
  issuer_id: "Issued by",
  recipient_member_id: "Recipient",
  instance_id: "Instance",
  delivery_id: "Delivery",
  resolution: "Resolution",
  old_instance_id: "Previous version",
  new_instance_id: "New version",
  revoked_at: "Revoked at",
  form_type: "Form type",
  name: "Name",
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  card_form: "CARD Form",
  card_instance: "CARD Instance",
  card_issuance: "CARD Issuance",
};

function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

interface AuditEntry {
  id: string;
  action: string;
  actor_id?: string | null;
  entity_type: string;
  entity_id: string;
  lifecycle_context: any;
  created_at: string;
}

interface Props {
  entry: AuditEntry;
  isLast: boolean;
}

export function AuditTimelineEvent({ entry, isLast }: Props) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[entry.action] || {
    icon: "📝",
    label: entry.action.replace(/_/g, " "),
    color: "border-border bg-muted/30",
  };

  const ctx = entry.lifecycle_context;
  const ctxEntries = ctx && typeof ctx === "object" ? Object.entries(ctx) : [];
  const entityLabel = ENTITY_TYPE_LABELS[entry.entity_type] || entry.entity_type;

  const formattedDate = new Date(entry.created_at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <span className="text-xl leading-none mt-0.5">{meta.icon}</span>
        {!isLast && (
          <div className="w-px flex-1 bg-border mt-2" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 rounded-lg border p-3 mb-4", meta.color)}>
        <p className="font-medium text-sm">{meta.label}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          <span>{formattedDate}</span>
          <span className="inline-flex items-center gap-1">
            {entityLabel} ·{" "}
            <CopyIdButton
              value={entry.entity_id}
              label=""
              variant="inline"
              className="text-muted-foreground"
            />
          </span>
        </div>

        {ctxEntries.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  open && "rotate-180"
                )}
              />
              {open ? "Hide details" : "Show details"}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {ctxEntries.map(([key, val]) => {
                const label = CONTEXT_LABELS[key] || key.replace(/_/g, " ");
                const strVal = String(val);
                const isId = isUuid(strVal);

                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium min-w-[110px]">
                      {label}:
                    </span>
                    {isId ? (
                      <CopyIdButton value={strVal} variant="inline" />
                    ) : (
                      <span className="font-mono">{strVal}</span>
                    )}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
