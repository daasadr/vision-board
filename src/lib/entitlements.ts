import { useEffect, useState } from "react";
import { ipc, type Entitlement } from "./ipc";

let cache: Promise<Entitlement[]> | undefined;

/** Entitlements are fixed for the app session (activation reloads the app), so ask once. */
function loadEntitlements(): Promise<Entitlement[]> {
  cache ??= ipc.entitlements().catch((error: unknown) => {
    cache = undefined;
    throw error;
  });
  return cache;
}

/** Whether a feature is available. Anything that is not a premium feature is always free. */
export function isEnabled(entitlements: Entitlement[], feature: string): boolean {
  return entitlements.find((e) => e.feature === feature)?.enabled ?? true;
}

/**
 * Availability of a feature for gating UI: `null` while unknown, so premium controls never
 * flash as unlocked. Premium features are looked up only through this hook.
 */
export function useEntitlement(feature: string): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    loadEntitlements()
      .then((list) => active && setEnabled(isEnabled(list, feature)))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, [feature]);
  return enabled;
}

/** Test helper: forget the cached answer. */
export function resetEntitlementsCache() {
  cache = undefined;
}
