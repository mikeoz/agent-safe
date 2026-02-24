import { useEffect } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Opn.li Agent Safe",
  "/entities": "Entities & Agents — Opn.li Agent Safe",
  "/data": "Data Rooms — Opn.li Agent Safe",
  "/cards": "CARDs — Opn.li Agent Safe",
  "/cards/use/new": "CARDs — Opn.li Agent Safe",
  "/activity": "Activities & Reports — Opn.li Agent Safe",
};

export function usePageTitle(pathname: string) {
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] || "Opn.li Agent Safe";
  }, [pathname]);
}
