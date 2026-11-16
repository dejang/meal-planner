import { useEffect, useState } from "react";
import { Button, ButtonVariant } from "../../components/Button";
import { PaperDialog } from "../../components/PaperDialog";
import { TextInput } from "../../components/TextInput";
import {
  useSettingsActions,
  useSettingsCredentials,
  useSettingsError,
  useSettingsLoadFailed,
  useSettingsLoading,
  useSettingsLinkError,
  useSettingsSaving,
  useSettingsStartupCredentials,
} from "../../stores/SettingsStore";
import "./settings.css";

export default function Settings() {
  const credentials = useSettingsCredentials();
  const loading = useSettingsLoading();
  const saving = useSettingsSaving();
  const error = useSettingsError();
  const actions = useSettingsActions();
  const loadFailed = useSettingsLoadFailed();
  const busy = loading || saving;

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  return (
    <form
      className="settings-surface"
      aria-label="Settings"
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void actions.save();
      }}
    >
      <label>
        Edamam API Key
        <TextInput
          value={credentials.api_key}
          disabled={busy}
          onChange={(event) =>
            actions.setCredentials({
              ...credentials,
              api_key: event.target.value,
            })
          }
        />
      </label>
      <label>
        Edamam APP ID
        <TextInput
          value={credentials.app_id}
          disabled={busy}
          onChange={(event) =>
            actions.setCredentials({
              ...credentials,
              app_id: event.target.value,
            })
          }
        />
      </label>
      {loading && <p role="status">Loading credentials…</p>}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" variant={ButtonVariant.Primary} disabled={busy}>
        {saving ? "Saving…" : "Save"}
      </Button>
      {loadFailed && (
        <Button onClick={() => void actions.reload()} disabled={busy}>
          Retry loading
        </Button>
      )}
    </form>
  );
}

export function Welcome() {
  const credentials = useSettingsStartupCredentials();
  const actions = useSettingsActions();
  const [dismissed, setDismissed] = useState(false);
  const linkError = useSettingsLinkError();

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  if (
    !credentials ||
    dismissed ||
    (credentials.api_key !== "" && credentials.app_id !== "")
  )
    return null;

  return (
    <PaperDialog title="Welcome" onClose={() => setDismissed(true)}>
      <section className="settings-surface welcome-surface">
        <h3>You haven't configured APP_ID and API_KEY for Edamam service</h3>
        <p>
          Go to{" "}
          <a
            href="https://www.edamam.com"
            onClick={(event) => {
              event.preventDefault();
              void actions.openSite(event.currentTarget.href);
            }}
          >
            https://www.edamam.com
          </a>{" "}
          and sign up for a free account.
        </p>
        <p>
          Create a new app for the Nutrition Analysis API. Use the API_KEY and
          APP_ID in Settings Window.
        </p>
        <p>
          You can use the Planner and Browse Recipe features without an Edamam
          account.
        </p>
        {linkError && <p role="alert">{linkError}</p>}
      </section>
    </PaperDialog>
  );
}
