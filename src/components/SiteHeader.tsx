/**
 * En-tête commun aux écrans qui parlent d'un site : sélecteur et identité.
 *
 * Extrait de l'écran de supervision quand le diagnostic est devenu un second
 * écran. Les deux montrent le même site, et devaient donc montrer le même
 * en-tête — le dupliquer aurait garanti qu'ils divergent au premier
 * changement.
 *
 * Collé en haut (`sticky`) : les écrans sont longs, et le site affiché est le
 * contexte de tout ce qu'on lit en dessous. Sans lui sous les yeux, on descend
 * dans les alertes ou les diagnostics sans plus savoir de quel site ils
 * parlent, et changer de site imposait de remonter. Attention si la mise en
 * page du layout évolue : un ancêtre en `overflow` autre que `visible`
 * annulerait le collage.
 */

import type { Site } from "../api/sites";
import { SiteSelector } from "./SiteSelector";

interface SiteHeaderProps {
  sites: readonly Site[];
  selectedSite: Site | null;
  onSelect: (siteId: string) => void;
  isLoading: boolean;
}

export function SiteHeader({
  sites,
  selectedSite,
  onSelect,
  isLoading,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-ardoise-200 bg-white shadow-surface">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          {/* Le sélecteur ne s'étire pas indéfiniment sur un grand écran :
              une liste déroulante de 1 200 px de large est illisible. */}
          <div className="w-full sm:max-w-sm">
            <SiteSelector
              sites={sites}
              selectedSiteId={selectedSite?.site_id ?? null}
              onSelect={onSelect}
              isLoading={isLoading}
            />
          </div>
          {selectedSite !== null && (
            <div className="text-corps text-ardoise-600 sm:text-right">
              <p className="font-medium text-ardoise-900">
                Puissance souscrite {selectedSite.capacity_kw} kW
              </p>
              <p>
                {selectedSite.location} · {selectedSite.site_type} · {selectedSite.status}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
