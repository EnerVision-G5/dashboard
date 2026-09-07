/**
 * Panneau « Écart prédiction / réel » (EV-52).
 *
 * L'API compare les prévisions **archivées** — celles qui ont réellement été
 * servies — à la consommation mesurée, et publie le résultat. Le dashboard ne
 * recalcule rien : refaire ce calcul côté navigateur donnerait un second
 * chiffre, différent du premier, sans qu'on sache lequel croire.
 *
 * Un piège du contrat est traité explicitement. `drift` vaut `false` quand
 * aucune paire n'existe, et sa description le dit : « rien n'a été mesuré, ce
 * n'est pas une absence de dérive mais elle ne doit pas être annoncée ». Le
 * panneau n'affiche donc **aucun verdict** tant que `paired_points` vaut zéro,
 * au lieu du « pas de dérive » rassurant que le booléen laisserait écrire.
 *
 * Le biais est affiché signé, et traduit : « surestime » ou « sous-estime ».
 * C'est l'information qu'une erreur absolue ne peut pas donner, et celle qui se
 * discute avec un exploitant.
 */

import type { AccuracyIndicator } from "../api/indicators";
import { formatRatio } from "../lib/dataHealth";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface ForecastAccuracyPanelProps {
  accuracy: AccuracyIndicator | null;
  isLoading: boolean;
  error: string | null;
}

/** Sens du biais, en mots. */
function describeBias(biasKw: number): string {
  if (biasKw === 0) {
    return "Le modèle ne penche ni au-dessus ni en dessous du réel";
  }
  return biasKw > 0
    ? "Le modèle surestime la consommation"
    : "Le modèle sous-estime la consommation";
}

export function ForecastAccuracyPanel({
  accuracy,
  isLoading,
  error,
}: ForecastAccuracyPanelProps) {
  return (
    <Card title="Écart prédiction / réel">
      {isLoading && <LoadingState>Lecture de l'écart entre prévision et mesure…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="Écart prédiction / réel indisponible">{error}</ErrorState>
      )}

      {!isLoading && error === null && accuracy === null && (
        <EmptyState>Aucun indicateur d'écart pour ce site.</EmptyState>
      )}

      {/* Zéro paire : les autres champs sont nuls, et le booléen `drift` ne
          veut rien dire. On explique la situation au lieu de la qualifier. */}
      {!isLoading && error === null && accuracy !== null && accuracy.paired_points === 0 && (
        <EmptyState detail="Le job de prédiction archive une série par heure ; la comparaison devient possible dès qu'une heure prédite a été mesurée.">
          Aucune prévision archivée n'a encore de mesure à laquelle se comparer.
        </EmptyState>
      )}

      {!isLoading && error === null && accuracy !== null && accuracy.paired_points > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MetricTile label="Erreur moyenne" value={accuracy.mae_kw} unit="kW" />
            <MetricTile label="Biais" value={accuracy.bias_kw} unit="kW" />
          </div>

          <dl className="mt-4 flex flex-col gap-1 text-corps">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ardoise-600">Consommation réelle moyenne</dt>
              <dd data-valeur className="font-medium text-ardoise-900">
                {accuracy.mean_actual_kw === null
                  ? "—"
                  : `${accuracy.mean_actual_kw.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })} kW`}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ardoise-600">Heures comparées</dt>
              <dd data-valeur className="font-medium text-ardoise-900">
                {accuracy.paired_points}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ardoise-600">Mesures dans l'intervalle annoncé</dt>
              <dd data-valeur className="font-medium text-ardoise-900">
                {/* Nul quand aucune prévision appariée ne portait de bornes :
                    ce n'est pas 0 %, c'est une question sans objet. */}
                {accuracy.within_bounds_ratio === null
                  ? "aucun intervalle annoncé"
                  : `${formatRatio(accuracy.within_bounds_ratio)} sur ${accuracy.bounded_points} h`}
              </dd>
            </div>
          </dl>

          <ul className="mt-3 flex flex-col gap-1 text-corps text-ardoise-600">
            {accuracy.bias_kw !== null && <li>{describeBias(accuracy.bias_kw)}.</li>}
            {accuracy.drift ? (
              <li className="font-medium text-estimation-800">
                Dérive : l'erreur moyenne dépasse {formatRatio(accuracy.drift_threshold_ratio)}{" "}
                de la consommation moyenne, seuil de l'API.
              </li>
            ) : (
              <li>
                Pas de dérive au seuil de l'API ({formatRatio(accuracy.drift_threshold_ratio)}{" "}
                de la consommation moyenne).
              </li>
            )}
            {accuracy.model_versions.length > 0 && (
              <li>
                Modèle{accuracy.model_versions.length > 1 ? "s" : ""} comparé
                {accuracy.model_versions.length > 1 ? "s" : ""} :{" "}
                {accuracy.model_versions.join(", ")}.
              </li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}
