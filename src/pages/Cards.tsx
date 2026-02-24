import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Cards() {
  usePageTitle(useLocation().pathname);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">CARDs</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Community Approved Reliable Data — your permission slips.
      </p>
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Full CARDs management is coming soon.
        </p>
      </div>
    </div>
  );
}
