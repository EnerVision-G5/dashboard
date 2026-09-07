/**
 * Écran de diagnostic d'un site.
 *
 * L'écran de supervision mélangeait trois natures d'information qui n'ont pas
 * le même public : ce qu'on **surveille** (courbe, temps réel, alertes,
 * recommandations), ce qui **explique la donnée** (ingestion, écart
 * prédiction/réel, mesures écartées, registre des modèles) et ce qui **agit
 * sur la source** (déclencher un pic, resynchroniser). Onze cartes sur une
 * page : un mur, où l'on ne trouvait plus rien.
 *
 * Les deux dernières natures vivent ici. On y vient quand une valeur
 * surprend — d'où viennent les mesures, qu'a-t-on écarté, que vaut la
 * prévision, quel modèle est promu — pas pour surveiller.
 *
 * Le site examiné vient de l'adresse (`?site=`), comme sur la supervision :
 * passer d'un écran à l'autre ne perd donc pas le site, et l'adresse se
 * partage telle quelle.
 */

import { ExcludedMeasuresPanel } from "../components/ExcludedMeasuresPanel";
import { ForecastAccuracyPanel } from "../components/ForecastAccuracyPanel";
import { IngestionPanel } from "../components/IngestionPanel";
import { ModelRegistryPanel } from "../components/ModelRegistryPanel";
import { SiteActionsPanel } from "../components/SiteActionsPanel";
import { SiteHeader } from "../components/SiteHeader";
import { SpikeHistoryPanel } from "../components/SpikeHistoryPanel";
import { summarizeExclusions } from "../lib/series";
import { useModelRegistry } from "../hooks/useModelRegistry";
import { useSiteDiagnostics } from "../hooks/useSiteDiagnostics";
import { useSiteSeries } from "../hooks/useSiteSeries";
import { useSites } from "../hooks/useSites";
import { useSpikeHistory } from "../hooks/useSpikeHistory";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState } from "../ui/states";

export function SiteDiagnosticPage() {
  const {
    sites,
    selectedSite,
    selectSite,
    reload: reloadSites,
    isLoading: sitesLoading,
    error: sitesError,
  } = useSites();

  // Les mesures de la fenêtre servent ici au seul résumé des exclusions : la
  // fenêtre par défaut suffit, le choix de période appartient au graphique de
  // la supervision.
  const { points, isLoading: seriesLoading, windowHours } = useSiteSeries(
    selectedSite?.site_id ?? null,
  );
  const {
    indicators,
    failures,
    isLoading: diagnosticsLoading,
    indicatorsError,
    failuresError,
  } = useSiteDiagnostics(selectedSite?.site_id ?? null);
  const {
    spikes,
    isLoading: spikesLoading,
    error: spikesError,
    reload: reloadSpikes,
  } = useSpikeHistory(selectedSite?.site_id ?? null);
  const {
    current: currentModel,
    models,
    isLoading: modelsLoading,
    error: modelsError,
    currentError: currentModelError,
  } = useModelRegistry();

  const exclusions = summarizeExclusions(points);

  return (
    <>
      <SiteHeader
        sites={sites}
        selectedSite={selectedSite}
        onSelect={selectSite}
        isLoading={sitesLoading}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {sitesError !== null && (
          <ErrorState title="Référentiel des sites indisponible">{sitesError}</ErrorState>
        )}

        {sitesError === null && !sitesLoading && sites.length === 0 && (
          <Card>
            <EmptyState>Aucun site n'est encore supervisé par l'API métier.</EmptyState>
          </Card>
        )}

        {selectedSite !== null && (
          <>
            <h2 className="text-titre-section font-semibold text-ardoise-900">
              {selectedSite.site_name}
            </h2>

            {/* Deux colonnes plutôt que trois : ces panneaux portent des
                phrases et des listes, pas des chiffres isolés, et `items-start`
                leur laisse leur hauteur naturelle — c'est ce qui produisait les
                grands aplats blancs quand une carte vide était étirée à la
                hauteur de sa voisine. */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <IngestionPanel
                ingestion={indicators?.ingestion ?? null}
                isLoading={diagnosticsLoading}
                error={indicatorsError}
              />
              <ForecastAccuracyPanel
                accuracy={indicators?.accuracy ?? null}
                isLoading={diagnosticsLoading}
                error={indicatorsError}
              />
              <ExcludedMeasuresPanel
                exclusions={exclusions}
                failures={failures}
                isLoading={seriesLoading}
                failuresError={failuresError}
                windowHours={windowHours}
              />
              <ModelRegistryPanel
                current={currentModel}
                models={models}
                isLoading={modelsLoading}
                error={modelsError}
                currentError={currentModelError}
              />
            </div>

            {/* Les commandes en bas, après l'état : on agit sur la source
                quand on a compris ce qu'elle raconte. */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <SiteActionsPanel
                siteId={selectedSite.site_id}
                siteName={selectedSite.site_name}
                onSpikeTriggered={reloadSpikes}
                onSitesSynced={reloadSites}
              />
              <SpikeHistoryPanel
                spikes={spikes}
                isLoading={spikesLoading}
                error={spikesError}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
