/**
 * Sélecteur de site.
 *
 * Un `<select>` natif plutôt qu'une liste maison : le clavier, le focus et les
 * lecteurs d'écran fonctionnent sans code supplémentaire.
 */

import type { Site } from "../api/sites";

/** Identifiant du champ, partagé avec son `<label>`. */
export const SITE_SELECTOR_ID = "site-selector";

interface SiteSelectorProps {
  sites: readonly Site[];
  selectedSiteId: string | null;
  onSelect: (siteId: string) => void;
  isLoading: boolean;
}

export function SiteSelector({
  sites,
  selectedSiteId,
  onSelect,
  isLoading,
}: SiteSelectorProps) {
  const isEmpty = sites.length === 0;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={SITE_SELECTOR_ID}
        className="text-sm font-medium text-slate-700"
      >
        Site
      </label>
      <select
        id={SITE_SELECTOR_ID}
        className="min-w-64 rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
        value={selectedSiteId ?? ""}
        onChange={(event) => {
          onSelect(event.target.value);
        }}
        disabled={isLoading || isEmpty}
      >
        {isLoading && <option value="">Chargement des sites…</option>}
        {!isLoading && isEmpty && <option value="">Aucun site disponible</option>}
        {sites.map((site) => (
          <option key={site.site_id} value={site.site_id}>
            {site.site_name} — {site.location}
          </option>
        ))}
      </select>
    </div>
  );
}
