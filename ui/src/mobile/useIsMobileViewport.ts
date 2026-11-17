import { useCallback, useSyncExternalStore } from "react";

export function useIsMobileViewport(query = "(max-width: 768px)") {
  const subscribe = useCallback(
    (notify: () => void) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", notify);
      return () => media?.removeEventListener("change", notify);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => window.matchMedia?.(query).matches ?? false,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
