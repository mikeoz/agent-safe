import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CopyIdButton } from "@/components/CopyIdButton";
import { VersionLineage } from "./VersionLineage";
import { FileText, Shield, Bot } from "lucide-react";

const TYPE_BADGE_VARIANT: Record<string, string> = {
  entity: "bg-sky-100 text-sky-800 border-sky-200",
  data: "bg-violet-100 text-violet-800 border-violet-200",
  use: "bg-amber-100 text-amber-800 border-amber-200",
};

const TYPE_ICON: Record<string, typeof FileText> = {
  entity: Shield,
  data: FileText,
  use: Bot,
};

function extractCardTitle(payload: any): string {
  return payload?.card?.title || "Untitled CARD";
}

function extractSubjectName(payload: any): string | null {
  return payload?.parties?.subject?.display_name || null;
}

function extractClaimsSummary(payload: any, formType: string): string {
  const items = payload?.claims?.items;
  if (!items || !Array.isArray(items) || items.length === 0) return "";

  if (formType === "entity") {
    const cat = items[0]?.category || "claim";
    return `${items.length} ${cat} claim${items.length > 1 ? "s" : ""}`;
  }

  if (formType === "data") {
    const uri = items[0]?.resource?.uri || "";
    const actions = items[0]?.constraints?.allowed_actions;
    const label = uri.split("/").pop() || uri;
    const actionStr = Array.isArray(actions) ? actions.join(", ") : "";
    return label ? `${label}${actionStr ? " — " + actionStr : ""}` : "";
  }

  if (formType === "use") {
    const agentName = payload?.parties?.agents?.[0]?.display_name || payload?.parties?.agents?.[0]?.id || "";
    const purpose = items[0]?.constraints?.purpose?.[0]?.code || "";
    return agentName ? `${agentName}${purpose ? " — " + purpose : ""}` : purpose;
  }

  return "";
}

export interface CardInstanceItem {
  id: string;
  form_id: string;
  payload: any;
  created_at: string;
  is_current: boolean;
  superseded_by: string | null;
  card_forms?: { name: string; form_type: string } | null;
}

interface InstanceCardProps {
  instance: CardInstanceItem;
  versionNumber?: number | null;
  onIssue: (instance: CardInstanceItem) => void;
}

export function InstanceCard({ instance, versionNumber, onIssue }: InstanceCardProps) {
  const formType = instance.card_forms?.form_type || "entity";
  const title = extractCardTitle(instance.payload);
  const subject = extractSubjectName(instance.payload);
  const claimsSummary = extractClaimsSummary(instance.payload, formType);
  const Icon = TYPE_ICON[formType] || FileText;
  const hasVersionHistory = versionNumber !== null && versionNumber !== undefined && versionNumber > 1;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-start gap-4 p-4">
        <div className="shrink-0 mt-0.5 rounded-md bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base leading-tight">{title}</span>
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_VARIANT[formType] || ""}`}
            >
              {formType}
            </span>
            {hasVersionHistory && (
              <Badge variant="outline" className="text-xs font-mono">
                v{versionNumber}
              </Badge>
            )}
          </div>
          {subject && <p className="text-sm text-muted-foreground">{subject}</p>}
          {claimsSummary && <p className="text-sm text-muted-foreground/80 truncate">{claimsSummary}</p>}
          <div className="flex items-center gap-3 pt-1">
            <CopyIdButton value={instance.id} label="ID" variant="inline" className="text-muted-foreground/70" />
            <span className="text-xs text-muted-foreground/60">
              {new Date(instance.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          {hasVersionHistory && <VersionLineage instanceId={instance.id} />}
        </div>
        <div className="shrink-0 flex gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
          >
            <Link
              to={`/instances/create?reviseId=${instance.id}&formId=${instance.form_id}`}
            >
              Revise
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onIssue(instance)}>
            Issue
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to={`/audit?entityType=card_instance&entityId=${instance.id}`}>Audit</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
