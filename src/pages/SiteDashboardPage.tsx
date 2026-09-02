/**
 * Écran EV-16 : choisir un site et lire sa consommation réelle face à sa
 * prédiction, sur un même graphique.
 *
 * Le périmètre s'arrête là. Alertes, recommandations, authentification et
 * indicateurs relèvent d'autres tickets et n'apparaissent pas ici.
 */

import { ConsumptionPredictionChart } from "../components/ConsumptionPredictionChart";
import { SiteSelector } from "../components/SiteSelector";
import { countMissingReadings } from "../lib/series";
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
  const { sites, selectedSite, selectSite, isLoading: sitesLoading, error: sitesError } =
    useSites();
  const {
    points,
    prediction,
    isLoading: seriesLoading,
    readingsError,
    predictionError,
    windowHours,
  } = useSiteSeries(selectedSite?.site_id ?? null);

  const hasActual = points.some((point) => point.actualKw !== null);
  const hasPredicted = points.some((point) => point.predictedKw !== null);
  const missingReadings = countMissingReadings(points);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">EnerVision</h1>
            <p className="text-sm text-slate-600">
              Consommation et prédiction sur les {windowHours} dernières heures
            </p>
          </div>
          <SiteSelector
            sites={sites}
            selectedSiteId={selectedSite?.site_id ?? null}
            onSelect={selectSite}
            isLoading={sitesLoading}
          />
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6">
        {sitesError !== null && (
          <ErrorNotice title="Référentiel des sites indisponible" message={sitesError} />
        )}

        {sitesError === null && !sitesLoading && sites.length === 0 && (
          <Panel>Aucun site n'est encore supervisé par l'API métier.</Panel>
        )}

        {selectedSite !== null && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold text-slate-900">{selectedSite.site_name}</h2>
              <p className="text-sm text-slate-600">
                {selectedSite.location} · {selectedSite.site_type} · capacité{" "}
                {selectedSite.capacity_kw} kW · {selectedSite.status}
              </p>
            </div>

            {readingsError !== null && (
              <ErrorNotice title="Mesures indisponibles" message={readingsError} />
            )}
            {predictionError !== null && (
              <ErrorNotice title="Prédiction indisponible" message={predictionError} />
            )}

            {seriesLoading ? (
              <Panel>
                <p role="status">Chargement des données du site {selectedSite.site_name}…</p>
              </Panel>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                {points.length === 0 ? (
                  <p className="p-6 text-slate-700">
                    Aucune donnée à afficher pour ce site sur les {windowHours} dernières heures.
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
                      {missingReadings} mesure(s) absente(s) de la source, laissées en trou dans la
                      courbe.
                    </li>
                  )}
                  {prediction !== null && <li>Modèle : {prediction.model_version}</li>}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
