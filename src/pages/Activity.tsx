import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import AuditTrail from "./AuditTrail";

export default function Activity() {
  usePageTitle(useLocation().pathname);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Activities &amp; Reports</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Every action at your front door — permanent and tamper-evident.
      </p>
      <AuditTrail />
    </div>
  );
}
