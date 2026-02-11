import { AuditTimelineEvent } from "./AuditTimelineEvent";

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
  entries: AuditEntry[];
  emptyMessage?: string;
}

export function AuditTimeline({
  entries,
  emptyMessage = "No audit events recorded yet. Audit events appear here as you create and share CARDs.",
}: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6">{emptyMessage}</p>
    );
  }

  return (
    <div className="py-2">
      {entries.map((entry, i) => (
        <AuditTimelineEvent
          key={entry.id}
          entry={entry}
          isLast={i === entries.length - 1}
        />
      ))}
    </div>
  );
}
