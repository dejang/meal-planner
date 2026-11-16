import { useEffect } from "react";
import { Button, ButtonVariant } from "../../components/Button";
import { TextInput } from "../../components/TextInput";
import {
  useImportActions,
  useImportError,
  useImportImporting,
  useImportSupportedSites,
  useImportUrl,
} from "../../stores/ImportStore";
import "./import.css";

export default function Import() {
  const actions = useImportActions();
  const url = useImportUrl();
  const importing = useImportImporting();
  const error = useImportError();
  const supportedSites = useImportSupportedSites();

  useEffect(() => {
    void actions.reload();
  }, [actions]);

  return (
    <section className="recipe-import" aria-label="Import">
      <p className="import-subtitle">
        Bring a recipe into your collection, ready to edit.
      </p>
      <form
        className="import-form"
        aria-busy={importing}
        onSubmit={(event) => {
          event.preventDefault();
          void actions.importRecipe();
        }}
      >
        <label htmlFor="import-recipe-url">RECIPE URL</label>
        <TextInput
          id="import-recipe-url"
          placeholder="https://…"
          value={url}
          disabled={importing}
          onChange={(event) => actions.setUrl(event.target.value)}
          aria-describedby="import-url-hint"
        />
        <p id="import-url-hint">
          Paste a recipe link from a supported website below.
        </p>
        <div className="import-submit">
          <Button
            type="submit"
            variant={ButtonVariant.Primary}
            disabled={importing || !url.trim()}
          >
            {importing && (
              <span className="import-spinner" aria-hidden="true" />
            )}
            {importing ? "Importing…" : "Import recipe"}
          </Button>
        </div>
        {error && (
          <p className="import-error" role="alert">
            {error}
          </p>
        )}
      </form>
      <h3>SUPPORTED WEBSITES</h3>
      <ul className="import-sites">
        {supportedSites.map((site) => (
          <li key={site.name}>
            <strong>{site.name}</strong>
            <ul>
              {site.domains.map((domain) => (
                <li key={domain}>
                  <a
                    href={`https://${domain}`}
                    onClick={(event) => {
                      event.preventDefault();
                      void actions.openSite(event.currentTarget.href);
                    }}
                  >
                    {domain}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
