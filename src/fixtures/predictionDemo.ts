/**
 * Prédiction de démonstration, servie depuis un JSON versionné.
 *
 * Ce mode n'existe que parce qu'aucune prédiction n'est encore archivée en
 * base : le job planifié de l'API doit avoir tourné pour que
 * `GET /api/v1/sites/{site_id}/predictions` renvoie autre chose qu'une page
 * vide. Il s'active uniquement par configuration explicite
 * (`VITE_PREDICTION_SOURCE=fixture`), jamais en réaction à une erreur, et
 * l'écran l'annonce visuellement.
 *
 * Pour le retirer une fois des prédictions archivées : repasser la variable à
 * `api`. La suppression complète se limite à ce dossier, à
 * `getPredictionSource` et au bandeau de démonstration.
 *
 * Le JSON est figé : mêmes horodatages, mêmes valeurs à chaque exécution. Seul
 * un décalage en jours entiers est appliqué pour amener la série en face de la
 * fenêtre affichée, ce qui préserve le profil jour/nuit de la courbe.
 */

import type { Prediction, PredictionPoint } from "../api/predictions";
import demoPrediction from "./prediction-demo.json";

/**
 * Forme du JSON versionné : une prévision enveloppant ses points, telle que le
 * service d'inférence la renvoie.
 *
 * L'API, elle, sert des lignes plates portant chacune leur version et leur
 * date de production. Le JSON est conservé dans sa forme d'origine, plus
 * lisible pour une donnée écrite à la main, et `buildDemoPrediction` fait la
 * conversion — la même que celle de `toPrediction`, en sens inverse.
 */
interface DemoPredictionFile {
  site_id: string;
  model_version: string;
  generated_at: string;
  points: {
    timestamp: string;
    predicted_consumption_kw: number;
    lower_bound_kw: number | null;
    upper_bound_kw: number | null;
  }[];
}

/** Contenu brut du JSON de démonstration. */
export const DEMO_PREDICTION = demoPrediction satisfies DemoPredictionFile;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Décalage en jours entiers amenant le premier point à ou après `referenceIso`.
 *
 * Fonction pure : à fenêtre égale, le résultat est toujours le même.
 */
export function alignmentShiftMs(
  prediction: DemoPredictionFile,
  referenceIso: string,
): number {
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
 * Le site est repris de celui affiché pour que la réponse reste cohérente avec
 * l'écran ; `model_version` conserve son marqueur `demo-fixture`, qui identifie
 * sans ambiguïté une donnée simulée, et se retrouve sur chaque point comme
 * l'API le fait.
 */
export function buildDemoPrediction(siteId: string, referenceIso: string): Prediction {
  const shift = alignmentShiftMs(DEMO_PREDICTION, referenceIso);
  const points: PredictionPoint[] = DEMO_PREDICTION.points.map((point) => ({
    ...point,
    timestamp: new Date(Date.parse(point.timestamp) + shift).toISOString(),
    model_version: DEMO_PREDICTION.model_version,
    generated_at: DEMO_PREDICTION.generated_at,
  }));

  return {
    siteId,
    modelVersion: DEMO_PREDICTION.model_version,
    generatedAt: DEMO_PREDICTION.generated_at,
    points,
  };
}
