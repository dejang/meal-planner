import { openUrl } from "@tauri-apps/plugin-opener";
import { errorMessage } from "./error";

export function createOpenSiteAction(report: (error: string | null) => void) {
  return async (url: string): Promise<void> => {
    report(null);
    try {
      await openUrl(url);
    } catch (error) {
      report(errorMessage(error));
    }
  };
}
