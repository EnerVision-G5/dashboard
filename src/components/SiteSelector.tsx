/**
 * Sélecteur de site.
 *
 * Repose sur `SelectField` du design system : un `<select>` natif, dont le
 * clavier, le focus et la restitution par les lecteurs d'écran fonctionnent
 * sans code supplémentaire. Le composant ne garde que ce qui lui est propre —
 * la mise en forme d'un site en option, et le libellé de l'état vide.
 */

import { useMemo } from "react";
import type { Site } from "../api/sites";
import { SelectField } from "../ui/Field";

/** Étiquette du champ, partagée avec les tests et la page. */
export const SITE_SELECTOR_LABEL = "Site";

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

  const options = useMemo(
    () =>
      sites.map((site) => ({
        value: site.site_id,
        label: `${site.site_name} — ${site.location}`,
      })),
    [sites],
  );

  // L'option de remplacement ne s'affiche que quand la liste ne peut rien
  // proposer : elle dit alors pourquoi, plutôt que de laisser un champ vide.
  const placeholder = isLoading
    ? "Chargement des sites…"
    : isEmpty
      ? "Aucun site disponible"
      : undefined;

  return (
    <SelectField
      label={SITE_SELECTOR_LABEL}
      options={options}
      placeholder={placeholder}
      value={selectedSiteId ?? ""}
      onChange={(event) => {
        onSelect(event.target.value);
      }}
      disabled={isLoading || isEmpty}
    />
  );
}
