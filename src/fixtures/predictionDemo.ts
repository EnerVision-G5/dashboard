/**
 * Prédiction de démonstration, servie depuis un JSON versionné.
 *
 * Ce mode n'existe que parce que `POST /api/v1/predict` ne sert pas encore de
 * prévision réelle : depuis la fusion de predict#26, l'endpoint est implémenté
 * mais répond 503 tant que le registre MLflow n'expose pas de modèle entraîné.
 * Il s'active uniquement par configuration explicite
 * (`VITE_PREDICTION_SOURCE=fixture`), jamais en réaction à une erreur, et
 * l'écran l'annonce visuellement.
 *
 * Pour le retirer une fois un modèle publié : repasser la variable à `api`. La
 * suppression complète se limite à ce dossier, à `getPredictionSource` et au
 * bandeau de démonstration.
 *
 * Le JSON est figé : mêmes horodatages, mêmes valeurs à chaque exécution. Seul
 * un décalage en jours entiers est appliqué pour amener la série en face de la
 * fenêtre affichée, ce qui préserve le profil jour/nuit de la courbe.
 */

import type { Prediction } from "../api/predictions";
import demoPrediction from "./prediction-demo.json";

/** Contenu brut du JSON, validé contre le DTO du contrat gelé. */
export const DEMO_PREDICTION = demoPrediction satisfies Prediction;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Décalage en jours entiers amenant le premier point à ou après `referenceIso`.
 *
 * Fonction pure : à fenêtre égale, le résultat est toujours le même.
 */
export function alignmentShiftMs(prediction: Prediction, referenceIso: string): number {
  const first = Date.parse(prediction.points[0]?.timestamp ?? "");
  const reference = Date.parse(referenceIso);
  if (Number.isNaN(first) || Number.isNaN(reference) || first >= reference) {
    return 0;
  }
  return Math.ceil((reference - first) / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * Construit la prévision de démonstration pour un site et une fenêtre donnés.
 *
 * `site_id` est repris du site affiché pour que la réponse reste cohérente avec
 * l'écran ; `model_version` conserve son marqueur `demo-fixture`, qui identifie
 * sans ambiguïté une donnée simulée.
 */
export function buildDemoPrediction(siteId: string, referenceIso: string): Prediction {
  const shift = alignmentShiftMs(DEMO_PREDICTION, referenceIso);
  return {
    ...DEMO_PREDICTION,
    site_id: siteId,
    points: DEMO_PREDICTION.points.map((point) => ({
      ...point,
      timestamp: new Date(Date.parse(point.timestamp) + shift).toISOString(),
    })),
  };
}
