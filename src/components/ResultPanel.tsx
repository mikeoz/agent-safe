import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyIdButton } from "@/components/CopyIdButton";

interface ResultEntry {
  label: string;
  value: string;
}

interface ResultPanelProps {
  title: string;
  entries: ResultEntry[];
}

export function ResultPanel({ title, entries }: ResultPanelProps) {
  if (entries.length === 0) return null;

  return (
    <Card className="mt-4">
      <CardHeader className="py-3">
        <CardTitle className="text-sm">✓ {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {entries.map((entry) => (
          <CopyIdButton
            key={entry.label}
            value={entry.value}
            label={entry.label}
            variant="inline"
            className="block"
          />
        ))}
      </CardContent>
    </Card>
  );
}
