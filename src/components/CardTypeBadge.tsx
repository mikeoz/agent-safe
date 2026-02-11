import { Badge } from "@/components/ui/badge";

const TYPE_BADGE_CLASS: Record<string, string> = {
  entity: "bg-sky-100 text-sky-800 border-sky-200",
  data: "bg-violet-100 text-violet-800 border-violet-200",
  use: "bg-amber-100 text-amber-800 border-amber-200",
};

interface CardTypeBadgeProps {
  formType: string;
}

export function CardTypeBadge({ formType }: CardTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TYPE_BADGE_CLASS[formType] || ""}`}
    >
      {formType}
    </span>
  );
}
