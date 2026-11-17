import { useState } from "react";
import { Button, ButtonVariant } from "@/components/Button";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { TextInput } from "@/components/TextInput";
import {
  useSettingsActions,
  useSettingsCredentials,
  useSettingsError,
  useSettingsLinkError,
  useSettingsLoadFailed,
  useSettingsLoading,
  useSettingsSaving,
  useSettingsConfigured,
} from "@/stores/SettingsStore";
import "@/mobile/settings/settings.css";

export default function Settings(_props: { active: boolean }) {
  const credentials = useSettingsCredentials();
  const configured = useSettingsConfigured();
  const loading = useSettingsLoading();
  const saving = useSettingsSaving();
  const error = useSettingsError();
  const linkError = useSettingsLinkError();
  const loadFailed = useSettingsLoadFailed();
  const actions = useSettingsActions();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = loading || saving;

  return (
    <>
      <MobileHeader title="Settings" />
      <div className="mobile-settings mobile-content safe-area-sides">
        {configured === false && (
          <aside
            className="mobile-settings-welcome"
            aria-labelledby="mobile-welcome-title"
          >
            <h2 id="mobile-welcome-title" className="mobile-card-title">
              Welcome
            </h2>
            <p>
              To analyze recipes, visit Edamam and sign up for a free Recipe
              Nutrition API plan. Create an application, then copy its APP ID
              and API Key into the form below.
            </p>
            <p>
              You can keep browsing recipes and planning meals without keys.
            </p>
          </aside>
        )}
        <form
          className="mobile-settings-card"
          aria-label="Edamam credentials"
          aria-busy={busy}
          onSubmit={async (event) => {
            event.preventDefault();
            setSaved(false);
            setSaved(await actions.save());
          }}
          onChange={() => setSaved(false)}
        >
          <h2 className="mobile-card-title">Edamam credentials</h2>
          <label htmlFor="mobile-edamam-app-id">Edamam APP ID</label>
          <TextInput
            id="mobile-edamam-app-id"
            value={credentials.app_id}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={busy}
            onChange={(event) =>
              actions.setCredentials({
                ...credentials,
                app_id: event.target.value,
              })
            }
          />
          <label htmlFor="mobile-edamam-api-key">Edamam API Key</label>
          <div className="mobile-settings-key">
            <TextInput
              id="mobile-edamam-api-key"
              type={showKey ? "text" : "password"}
              value={credentials.api_key}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              required
              disabled={busy}
              onChange={(event) =>
                actions.setCredentials({
                  ...credentials,
                  api_key: event.target.value,
                })
              }
            />
            <Button
              aria-label={showKey ? "Hide API key" : "Show API key"}
              aria-controls="mobile-edamam-api-key"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "Hide" : "Show"}
            </Button>
          </div>
          {loading && <p role="status">Loading credentials…</p>}
          {error && <p role="alert">{error}</p>}
          {saved && <p role="status">Credentials saved.</p>}
          <Button type="submit" variant={ButtonVariant.Primary} disabled={busy}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {loadFailed && (
            <Button disabled={busy} onClick={() => void actions.reload()}>
              Retry loading
            </Button>
          )}
        </form>
        <Button
          onClick={() => void actions.openSite("https://www.edamam.com/")}
        >
          Visit edamam.com
        </Button>
        {linkError && <p role="alert">{linkError}</p>}
      </div>
    </>
  );
}
