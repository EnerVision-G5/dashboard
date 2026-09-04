/**
 * Écran de supervision d'un site, mis en page d'après la maquette
 * « Smart Energy Optimiser » et repris sur le design system (EV-47).
 *
 * L'identité du produit, l'utilisateur et la déconnexion sont portés par la
 * navigation principale d'EV-50 : cette page commence à son en-tête de site.
 *
 * Trois zones sous l'en-tête, comme la maquette les nomme :
 *   - Consommation temps réel, alimentée par GET /readings/latest ;
 *   - Recommandations, sans donnée tant que le contrat n'en publie pas ;
 *   - Indicateurs, qui porte le graphique consommation / prédiction d'EV-16.
 *
 * La grille passe de une à deux puis à trois zones selon la largeur : la
 * maquette est dessinée pour un écran large, mais un panneau temps réel doit
 * rester lisible sur un téléphone en intervention.
 */

import { ConsumptionPredictionChart } from "../components/ConsumptionPredictionChart";
import { DemoDataBadge } from "../components/DemoDataBadge";
import { RealtimeConsumptionPanel } from "../components/RealtimeConsumptionPanel";
import { RecommendationsPanel } from "../components/RecommendationsPanel";
import { SiteSelector } from "../components/SiteSelector";
import { countMissingReadings } from "../lib/series";
import { useLatestReading } from "../hooks/useLatestReading";
import { useSiteSeries } from "../hooks/useSiteSeries";
import { useSites } from "../hooks/useSites";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

export function SiteDashboardPage() {
  const { sites, selectedSite, selectSite, isLoading: sitesLoading, error: sitesError } =
    useSites();
  const {
    points,
    prediction,
    isLoading: seriesLoading,
    readingsError,
    predictionError,
    windowHours,
    predictionSource,
  } = useSiteSeries(selectedSite?.site_id ?? null);
  const {
    reading: latestReading,
    isLoading: latestLoading,
    error: latestError,
  } = useLatestReading(selectedSite?.site_id ?? null);

  const hasActual = points.some((point) => point.actualKw !== null);
  const hasPredicted = points.some((point) => point.predictedKw !== null);
  const missingReadings = countMissingReadings(points);

  return (
    <>
      <header className="border-b border-ardoise-200 bg-white">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            {/* Le sélecteur ne s'étire pas indéfiniment sur un grand écran :
                une liste déroulante de 1 200 px de large est illisible. */}
            <div className="w-full sm:max-w-sm">
              <SiteSelector
                sites={sites}
                selectedSiteId={selectedSite?.site_id ?? null}
                onSelect={selectSite}
                isLoading={sitesLoading}
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

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {predictionSource === "fixture" && (
          <DemoDataBadge
            series="La courbe de prédiction provient d'un JSON figé, pas du service d'inférence"
            reason="Les mesures, elles, viennent bien de l'API métier."
          />
        )}

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

            {/* Une colonne sur mobile ; deux dès la tablette, le graphique
                passant alors pleine largeur sous les panneaux ; les trois zones
                de la maquette côte à côte sur grand écran. Le graphique reçoit
                la moitié de la grille : c'est lui qui a besoin de place. */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <RealtimeConsumptionPanel
                  reading={latestReading}
                  isLoading={latestLoading}
                  error={latestError}
                />
              </div>

              <div className="lg:col-span-3">
                <RecommendationsPanel />
              </div>

              <div className="md:col-span-2 lg:col-span-6">
                <Card
                  title="Indicateurs"
                  description={`Consommation et prédiction sur les ${windowHours} dernières heures`}
                >
                  <div className="flex flex-col gap-4">
                    {readingsError !== null && (
                      <ErrorState title="Mesures indisponibles">{readingsError}</ErrorState>
                    )}
                    {predictionError !== null && (
                      <ErrorState title="Prédiction indisponible">{predictionError}</ErrorState>
                    )}

                    {seriesLoading ? (
                      <LoadingState>
                        Chargement des données du site {selectedSite.site_name}…
                      </LoadingState>
                    ) : points.length === 0 ? (
                      <EmptyState>
                        Aucune donnée à afficher pour ce site sur les {windowHours} dernières
                        heures.
                      </EmptyState>
                    ) : (
                      <ConsumptionPredictionChart
                        points={points}
                        description={`Consommation réelle et prédiction du site ${selectedSite.site_name}, en kilowatts, sur les ${windowHours} dernières heures.`}
                      />
                    )}

                    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-corps text-ardoise-600">
                      {!seriesLoading && !hasActual && (
                        <li>Aucune mesure de consommation réelle sur la fenêtre.</li>
                      )}
                      {!seriesLoading && !hasPredicted && (
                        <li>Aucun point de prédiction sur la fenêtre.</li>
                      )}
                      {missingReadings > 0 && (
                        <li>
                          {missingReadings} mesure(s) absente(s) de la source, laissées en trou
                          dans la courbe.
                        </li>
                      )}
                      {prediction?.modelVersion != null && (
                        <li>Modèle : {prediction.modelVersion}</li>
                      )}
                    </ul>
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
