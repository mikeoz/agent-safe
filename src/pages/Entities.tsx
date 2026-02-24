import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Entities() {
  usePageTitle(useLocation().pathname);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Entities &amp; Agents</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The people, organisations, and AI agents in your trust network.
      </p>
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Entity and agent management is coming soon.
        </p>
      </div>
    </div>
  );
}
