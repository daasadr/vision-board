import { lazy, Suspense } from "react";
import { BoardApp } from "./board/BoardApp";

// Design system specimen, reachable only by URL (dev server, E2E). Loaded lazily so it stays
// out of the main bundle.
const DesignPage = lazy(() => import("./design/DesignPage"));

export function Root() {
  if (window.location.pathname === "/design") {
    return (
      <Suspense>
        <DesignPage />
      </Suspense>
    );
  }
  return <BoardApp />;
}
