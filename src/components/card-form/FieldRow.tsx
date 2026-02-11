import { ReactNode } from "react";
import { Label } from "@/components/ui/label";

interface FieldRowProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}

export function FieldRow({ label, htmlFor, required, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
