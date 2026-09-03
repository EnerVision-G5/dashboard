/**
 * Écran de supervision d'un site, mis en page d'après la maquette
 * « Smart Energy Optimiser ».
 *
 * Trois zones sous l'en-tête, comme la maquette les nomme :
 *   - Consommation temps réel, alimentée par GET /readings/latest ;
 *   - Recommandations, sans donnée tant que le contrat n'en publie pas ;
 *   - Indicateurs, qui porte le graphique consommation / prédiction d'EV-16.
 *
 * L'en-tête reprend le titre du produit, le sélecteur de site, et à droite la
 * puissance souscrite et la localisation du site choisi.
 */

import { ConsumptionPredictionChart } from "../components/ConsumptionPredictionChart";
import { DemoDataBadge } from "../components/DemoDataBadge";
import { RealtimeConsumptionPanel } from "../components/RealtimeConsumptionPanel";
import { RecommendationsPanel } from "../components/RecommendationsPanel";
import { SiteSelector } from "../components/SiteSelector";
import { countMissingReadings } from "../lib/series";
import { useAuth } from "../auth/useAuth";
import { useLatestReading } from "../hooks/useLatestReading";
import { useSiteSeries } from "../hooks/useSiteSeries";
import { useSites } from "../hooks/useSites";

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700 shadow-sm">
      {children}
    </div>
  );
}

function ErrorNotice({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
      <p className="font-medium">{title}</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function SiteDashboardPage() {
  const { session, signOut } = useAuth();
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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Smart Energy Optimiser</h1>
          {session !== null && (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>
                {session.claims.username}
                {session.claims.role !== null && ` · ${session.claims.role}`}
              </span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-teal-700 focus:outline-none"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <SiteSelector
            sites={sites}
            selectedSiteId={selectedSite?.site_id ?? null}
            onSelect={selectSite}
            isLoading={sitesLoading}
          />
          {selectedSite !== null && (
            <div className="text-sm text-slate-600 sm:text-right">
              <p className="font-medium text-slate-900">
                Puissance souscrite {selectedSite.capacity_kw} kW
              </p>
              <p>
                {selectedSite.location} · {selectedSite.site_type} · {selectedSite.status}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6">
        {predictionSource === "fixture" && (
          <DemoDataBadge
            series="La courbe de prédiction provient d'un JSON figé, pas du service d'inférence"
            reason="POST /api/v1/predict ne sert pas encore de prévision réelle (503 tant qu'aucun modèle n'est publié au registre). Les mesures, elles, viennent bien de l'API métier."
          />
        )}

        {sitesError !== null && (
          <ErrorNotice title="Référentiel des sites indisponible" message={sitesError} />
        )}

        {sitesError === null && !sitesLoading && sites.length === 0 && (
          <Panel>Aucun site n'est encore supervisé par l'API métier.</Panel>
        )}

        {selectedSite !== null && (
          <>
            <h2 className="text-lg font-semibold text-slate-900">
              {selectedSite.site_name}
            </h2>

            {/* Une colonne sur mobile, les trois zones de la maquette côte à
                côte dès que la largeur le permet. Le graphique reçoit deux
                colonnes sur douze de plus que les panneaux : c'est lui qui a
                besoin de place. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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

              <section
                aria-labelledby="indicators-heading"
                className="flex flex-col gap-4 lg:col-span-6"
              >
                <h2
                  id="indicators-heading"
                  className="text-base font-semibold text-slate-900"
                >
                  Indicateurs
                </h2>
                <p className="-mt-3 text-sm text-slate-600">
                  Consommation et prédiction sur les {windowHours} dernières heures
                </p>

                {readingsError !== null && (
                  <ErrorNotice title="Mesures indisponibles" message={readingsError} />
                )}
                {predictionError !== null && (
                  <ErrorNotice title="Prédiction indisponible" message={predictionError} />
                )}

                {seriesLoading ? (
                  <Panel>
                    <p role="status">
                      Chargement des données du site {selectedSite.site_name}…
                    </p>
                  </Panel>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    {points.length === 0 ? (
                      <p className="p-6 text-slate-700">
                        Aucune donnée à afficher pour ce site sur les {windowHours} dernières
                        heures.
                      </p>
                    ) : (
                      <ConsumptionPredictionChart
                        points={points}
                        description={`Consommation réelle et prédiction du site ${selectedSite.site_name}, en kilowatts, sur les ${windowHours} dernières heures.`}
                      />
                    )}

                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                      {!hasActual && <li>Aucune mesure de consommation réelle sur la fenêtre.</li>}
                      {!hasPredicted && <li>Aucun point de prédiction sur la fenêtre.</li>}
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
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
