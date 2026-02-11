import { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  children: ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <fieldset className="space-y-4 rounded-lg border p-4">
      <legend className="px-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
