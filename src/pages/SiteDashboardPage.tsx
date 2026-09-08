/**
 * Écran de supervision d'un site.
 *
 * Il ne porte plus que ce qu'on **surveille** : l'état instantané, la courbe,
 * les recommandations et les alertes. Ce qui explique la donnée — ingestion,
 * écart prédiction/réel, mesures écartées, registre des modèles — et ce qui
 * agit sur la source ont rejoint l'écran de diagnostic. Onze cartes sur une
 * page faisaient un mur ; il en reste quatre, et une hiérarchie.
 *
 * Le graphique trace la grandeur choisie — consommation, tension, intensité,
 * température, humidité, facteur de puissance — sans recharger : les mesures
 * portent toutes les grandeurs. Seule la consommation est prédite.
 *
 * L'ordre de lecture est celui de l'écran : l'état du site en une bande de
 * tuiles, la courbe qui l'inscrit dans le temps, puis les deux listes qui la
 * commentent — ce qu'il faudrait faire, et ce qui vient de se produire.
 *
 * Le site examiné vient de l'adresse (`?site=`), partagé avec le diagnostic.
 */

import { useState } from "react";
import { AlertsPanel } from "../components/AlertsPanel";
import { ConsumptionPredictionChart } from "../components/ConsumptionPredictionChart";
import { DataQualityBanner } from "../components/DataQualityBanner";
import { DataQualityBarChart } from "../components/DataQualityBarChart";
import { DemoDataBadge } from "../components/DemoDataBadge";
import { MeasurePicker } from "../components/MeasurePicker";
import { RealtimeConsumptionPanel } from "../components/RealtimeConsumptionPanel";
import { RecommendationsPanel } from "../components/RecommendationsPanel";
import { SiteHeader } from "../components/SiteHeader";
import { TimeRangePicker } from "../components/TimeRangePicker";
import { countMissingReadings } from "../lib/series";
import { measureOf, seriesLabel } from "../lib/measures";
import { DEFAULT_WINDOW_HOURS, recentWindow } from "../lib/timeWindow";
import { useAlerts } from "../hooks/useAlerts";
import { useDataHealth } from "../hooks/useDataHealth";
import { useLatestReading } from "../hooks/useLatestReading";
import { useRecommendations } from "../hooks/useRecommendations";
import { useSiteDiagnostics } from "../hooks/useSiteDiagnostics";
import { useSiteSeries } from "../hooks/useSiteSeries";
import { useSites } from "../hooks/useSites";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

export function SiteDashboardPage() {
  const {
    sites,
    selectedSite,
    selectSite,
    isLoading: sitesLoading,
    error: sitesError,
  } = useSites();
  // La fenêtre est fixée une fois, à l'ouverture, puis change sur demande.
  // La recalculer à chaque rendu relancerait les appels sans fin.
  const [timeWindow, setTimeWindow] = useState(() =>
    recentWindow(new Date(), DEFAULT_WINDOW_HOURS),
  );
  // La grandeur tracée est un réglage d'affichage : elle ne relance aucun
  // appel, les mesures portant déjà toutes les grandeurs.
  const [measureKey, setMeasureKey] = useState("consumption");
  const measure = measureOf(measureKey);

  const {
    points,
    prediction,
    isLoading: seriesLoading,
    readingsError,
    predictionError,
    windowHours,
    predictionSource,
  } = useSiteSeries(selectedSite?.site_id ?? null, timeWindow);
  const {
    reading: latestReading,
    isLoading: latestLoading,
    error: latestError,
  } = useLatestReading(selectedSite?.site_id ?? null);
  const {
    health,
    isLoading: healthLoading,
    indicatorsError,
    sensorsError,
  } = useDataHealth(
    selectedSite?.site_id ?? null,
    // Le référentiel est déjà à l'écran : le bandeau nomme les sites avec
    // lui plutôt que de relire /sites pour la même information.
    (siteId) => sites.find((site) => site.site_id === siteId)?.site_name ?? siteId,
  );
  const {
    alerts,
    isLoading: alertsLoading,
    error: alertsError,
    windowHours: alertsWindowHours,
  } = useAlerts(selectedSite?.site_id ?? null);
  const {
    recommendations,
    isLoading: recommendationsLoading,
    error: recommendationsError,
  } = useRecommendations(selectedSite?.site_id ?? null);
  // Seul le seuil de retard est lu ici, pour que la bande de tuiles et le
  // bandeau de fraîcheur parlent du même seuil, celui de l'API.
  const { indicators: siteIndicators } = useSiteDiagnostics(
    selectedSite?.site_id ?? null,
  );

  const hasActual = points.some((point) => point.values[measure.key] !== null);
  const hasPredicted = points.some((point) => point.predictedKw !== null);
  const missingReadings = countMissingReadings(points);

  return (
    <>
      <SiteHeader
        sites={sites}
        selectedSite={selectedSite}
        onSelect={selectSite}
        isLoading={sitesLoading}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
        {predictionSource === "fixture" && (
          <DemoDataBadge
            series="La courbe de prédiction provient d'un JSON figé, pas du service d'inférence"
            reason="Les mesures, elles, viennent bien de l'API métier."
          />
        )}

        {/* Le bandeau passe avant tout le reste : il qualifie ce que les
            panneaux du dessous affichent, et se lit donc en premier (EV-18). */}
        {selectedSite !== null && (
          <DataQualityBanner
            health={health}
            isLoading={healthLoading}
            indicatorsError={indicatorsError}
            sensorsError={sensorsError}
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

            {/* L'état instantané en bande : cinq nombres courts, qui se lisent
                d'un balayage horizontal. Empilés dans une colonne d'un tiers de
                largeur, ils occupaient une hauteur d'écran pour rien. */}
            <RealtimeConsumptionPanel
              reading={latestReading}
              isLoading={latestLoading}
              error={latestError}
              layout="bande"
              // Le seuil de retard vient de l'API, pas du front : les deux
              // panneaux de fraîcheur de l'écran disent alors la même chose.
              staleThresholdSeconds={siteIndicators?.ingestion.stale_threshold_seconds}
            />

            <Card
              title="Indicateurs"
              description={
                measure.predicted
                  ? `${measure.label} et prédiction sur ${windowHours} h`
                  : `${measure.label} sur ${windowHours} h`
              }
            >
              <div className="flex flex-col gap-4">
                {/* La clé remonte le sélecteur quand la fenêtre change par un
                    bouton de durée rapide : ses champs repartent alors de la
                    période appliquée. */}
                <MeasurePicker measure={measure} onSelect={setMeasureKey} />

                <TimeRangePicker
                  key={`${timeWindow.startTime}-${timeWindow.endTime}`}
                  window={timeWindow}
                  onApply={setTimeWindow}
                />

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
                  <EmptyState detail="Une autre période peut être appliquée ci-dessus.">
                    Aucune donnée à afficher pour ce site sur cette période.
                  </EmptyState>
                ) : (
                  <ConsumptionPredictionChart
                    points={points}
                    measure={measure}
                    description={`${seriesLabel(measure)}${measure.predicted ? " et prédiction" : ""} du site ${selectedSite.site_name}, du ${new Date(timeWindow.startTime).toLocaleString("fr-FR")} au ${new Date(timeWindow.endTime).toLocaleString("fr-FR")}.`}
                  />
                )}

                {!seriesLoading && points.length > 0 && (
                  <div>
                    <h3 className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase">
                      Qualité des mesures de la fenêtre
                    </h3>
                    <DataQualityBarChart points={points} />
                  </div>
                )}

                <ul className="flex flex-wrap gap-x-6 gap-y-1 text-corps text-ardoise-600">
                  {!seriesLoading && !hasActual && (
                    <li>
                      Aucune mesure de {measure.label.toLowerCase()} sur la fenêtre.
                    </li>
                  )}
                  {/* Le silence de la prédiction ne se commente que là où elle
                      existe : sur une autre grandeur, le modèle ne prévoit
                      rien, et l'annoncer manquant serait faux. */}
                  {!seriesLoading && measure.predicted && !hasPredicted && (
                    <li>Aucun point de prédiction sur la fenêtre.</li>
                  )}
                  {!measure.predicted && (
                    <li>Le modèle ne prévoit que la consommation.</li>
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

            {/* Ce qu'il faudrait faire, et ce qui vient de se produire : deux
                listes de même nature, donc deux colonnes égales. `items-start`
                leur laisse leur hauteur propre — c'est l'étirement à la hauteur
                de la voisine qui produisait les grands aplats blancs. */}
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <RecommendationsPanel
                recommendations={recommendations}
                isLoading={recommendationsLoading}
                error={recommendationsError}
              />
              <AlertsPanel
                alerts={alerts}
                isLoading={alertsLoading}
                error={alertsError}
                windowHours={alertsWindowHours}
              />
            </div>
          </>
        )}
      </main>
    </>
  );
}
