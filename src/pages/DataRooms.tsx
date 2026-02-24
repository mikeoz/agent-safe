import { useLocation } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function DataRooms() {
  usePageTitle(useLocation().pathname);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Data Rooms</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The data resources protected by your front door.
      </p>
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Data room views are coming soon.
        </p>
      </div>
    </div>
  );
}
