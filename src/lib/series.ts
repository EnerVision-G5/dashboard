/**
 * Fusion des mesures et de la prévision en une série unique pour Recharts.
 *
 * Fonction pure, sans DOM ni horloge : c'est la pièce où se joue la fidélité
 * des données, elle doit être vérifiable isolément.
 *
 * Trois règles y sont tenues :
 *   - un `consumption_kw` nul reste nul, il n'est ni comblé ni remplacé par la
 *     valeur imputée ; le graphique laissera un trou ;
 *   - `consumption_kw_imputed` est transporté à part, pour le survol, et n'est
 *     jamais tracé comme une mesure réelle ;
 *   - aucun point n'est fabriqué pour relier la dernière mesure à la première
 *     prédiction : les deux courbes ne se rejoignent que si le contrat renvoie
 *     réellement le même horodatage.
 */

import type { EnergyReading } from "../api/readings";
import type { PredictionPoint } from "../api/predictions";

/** Point de la série affichée, tous champs optionnels résolus à `null`. */
export interface ChartPoint {
  /** Horodatage en millisecondes depuis l'epoch, pour l'axe temporel numérique. */
  timestamp: number;
  /** Horodatage d'origine, ISO 8601 UTC. */
  isoTimestamp: string;
  /** Consommation réellement mesurée, `null` si la source ne l'a pas fournie. */
  actualKw: number | null;
  /** Consommation prédite par le service d'inférence. */
  predictedKw: number | null;
  /** Valeur reconstituée par l'ETL, affichée en information seulement. */
  imputedKw: number | null;
  /** Qualification de la mesure par la source. */
  dataQuality: EnergyReading["data_quality"] | null;
  /** Méthode d'imputation appliquée par l'ETL. */
  imputationMethod: EnergyReading["imputation_method"] | null;
  /** Vrai si la mesure a été écartée des calculs agrégés (contrat 1.5.0). */
  excluded: boolean;
  /** Motif de la mise à l'écart, nul si la mesure est retenue. */
  exclusionReason: string | null;
  /** Borne basse de l'intervalle de confiance, `null` si non calculée. */
  lowerBoundKw: number | null;
  /** Borne haute de l'intervalle de confiance, `null` si non calculée. */
  upperBoundKw: number | null;
}

function emptyPoint(isoTimestamp: string, timestamp: number): ChartPoint {
  return {
    timestamp,
    isoTimestamp,
    actualKw: null,
    predictedKw: null,
    imputedKw: null,
    dataQuality: null,
    imputationMethod: null,
    excluded: false,
    exclusionReason: null,
    lowerBoundKw: null,
    upperBoundKw: null,
  };
}

/**
 * Fusionne mesures et prédictions par horodatage, triées par ordre croissant.
 *
 * Un horodatage illisible est ignoré plutôt que converti en `NaN`, qui
 * casserait l'axe temporel.
 */
export function buildChartSeries(
  readings: readonly EnergyReading[],
  predictionPoints: readonly PredictionPoint[],
): ChartPoint[] {
  const byTimestamp = new Map<number, ChartPoint>();

  const pointAt = (isoTimestamp: string): ChartPoint | null => {
    const timestamp = Date.parse(isoTimestamp);
    if (Number.isNaN(timestamp)) {
      return null;
    }
    const existing = byTimestamp.get(timestamp);
    if (existing !== undefined) {
      return existing;
    }
    const created = emptyPoint(isoTimestamp, timestamp);
    byTimestamp.set(timestamp, created);
    return created;
  };

  for (const reading of readings) {
    const point = pointAt(reading.timestamp);
    if (point === null) {
      continue;
    }
    point.actualKw = reading.consumption_kw;
    point.imputedKw = reading.consumption_kw_imputed;
    point.dataQuality = reading.data_quality;
    point.imputationMethod = reading.imputation_method;
    // Une mesure écartée reste servie, et reste tracée : c'est au lecteur de
    // savoir qu'elle ne compte pas dans les agrégats, pas à l'écran de la
    // cacher. Le contrat est explicite là-dessus.
    point.excluded = reading.excluded ?? false;
    point.exclusionReason = reading.exclusion_reason ?? null;
  }

  for (const prediction of predictionPoints) {
    const point = pointAt(prediction.timestamp);
    if (point === null) {
      continue;
    }
    point.predictedKw = prediction.predicted_consumption_kw;
    point.lowerBoundKw = prediction.lower_bound_kw;
    point.upperBoundKw = prediction.upper_bound_kw;
  }

  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

/** Nombre de mesures dont la consommation réelle est absente. */
export function countMissingReadings(points: readonly ChartPoint[]): number {
  return points.filter((point) => point.dataQuality !== null && point.actualKw === null).length;
}

/**
 * Marge laissée au-dessus et au-dessous des valeurs, en part de leur amplitude.
 *
 * Sans elle, la courbe touche les bords du cadre et les extremums se
 * confondent avec l'axe.
 */
const VALUE_MARGIN_RATIO = 0.15;

/**
 * Bornes verticales calculées sur les valeurs réellement tracées.
 *
 * Recharts part de zéro par défaut. Sur un site dont la consommation oscille
 * entre 140 et 200 kW, les quatre cinquièmes du cadre servent alors à montrer
 * un vide, et les variations — c'est-à-dire l'information — s'aplatissent en
 * une ligne droite.
 *
 * Le compromis est connu : **un axe qui ne part pas de zéro amplifie
 * visuellement les écarts**. C'est le bon choix pour de la supervision, où l'on
 * cherche la variation et non la proportion, et l'axe reste gradué en
 * kilowatts, donc lisible sans être deviné.
 *
 * Rendre `auto` plutôt qu'un couple de nombres quand rien n'est tracé : une
 * fenêtre sans mesure ne doit pas produire un domaine inventé.
 */
export function valueDomain(
  points: readonly ChartPoint[],
): [number, number] | ["auto", "auto"] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  // Une boucle plutôt qu'un spread dans `Math.min` : une fenêtre profonde peut
  // porter des dizaines de milliers de points, au-delà de ce qu'un appel de
  // fonction accepte d'arguments.
  for (const point of points) {
    for (const valeur of [point.actualKw, point.predictedKw]) {
      if (valeur === null) {
        continue;
      }
      min = Math.min(min, valeur);
      max = Math.max(max, valeur);
    }
  }

  if (min === Number.POSITIVE_INFINITY) {
    return ["auto", "auto"];
  }
  // Série plate : une amplitude nulle donnerait un domaine dégénéré, que
  // Recharts rend par un axe sans graduation.
  if (min === max) {
    return [Math.floor(min - 1), Math.ceil(max + 1)];
  }

  const marge = (max - min) * VALUE_MARGIN_RATIO;
  return [Math.floor(min - marge), Math.ceil(max + marge)];
}

/** Répartition des mesures d'une fenêtre par qualification de la source. */
export interface QualityCount {
  /** Qualification telle que le contrat l'énumère. */
  quality: NonNullable<ChartPoint["dataQuality"]>;
  /** Nombre de mesures portant cette qualification. */
  count: number;
}

/** Les quatre qualifications, dans l'ordre du contrat, du meilleur au pire. */
const QUALITY_ORDER: NonNullable<ChartPoint["dataQuality"]>[] = [
  "good",
  "partial",
  "degraded",
  "critical",
];

/**
 * Compte les mesures par qualification (EV-19).
 *
 * Les quatre catégories sont toujours rendues, même à zéro : une barre absente
 * et une barre vide ne disent pas la même chose, et un graphique dont les
 * catégories changent d'une fenêtre à l'autre se compare mal.
 *
 * Les points purement prédits sont ignorés — leur `dataQuality` est nulle,
 * puisqu'aucune mesure ne leur correspond. Les compter reviendrait à qualifier
 * une prévision comme une mesure.
 */
export function countByQuality(points: readonly ChartPoint[]): QualityCount[] {
  const counts = new Map<NonNullable<ChartPoint["dataQuality"]>, number>(
    QUALITY_ORDER.map((quality) => [quality, 0]),
  );
  for (const point of points) {
    if (point.dataQuality === null) {
      continue;
    }
    counts.set(point.dataQuality, (counts.get(point.dataQuality) ?? 0) + 1);
  }
  return QUALITY_ORDER.map((quality) => ({ quality, count: counts.get(quality) ?? 0 }));
}

/** Mesures écartées d'une fenêtre, regroupées par motif. */
export interface ExclusionSummary {
  /** Nombre total de mesures écartées. */
  total: number;
  /** Motifs rencontrés, du plus fréquent au moins fréquent. */
  reasons: { reason: string; count: number }[];
  /** Horodatage de la première mesure écartée, ISO 8601. */
  firstAt: string | null;
  /** Horodatage de la dernière mesure écartée, ISO 8601. */
  lastAt: string | null;
}

/** Motif affiché quand la source écarte une mesure sans dire pourquoi. */
export const UNSPECIFIED_EXCLUSION_REASON = "motif non précisé par la source";

/**
 * Résume les mesures écartées d'une fenêtre.
 *
 * Une liste de 1 440 lignes n'apprendrait rien : ce qui se décide, c'est
 * combien de mesures ont été retirées des agrégats, pourquoi, et sur quelle
 * plage. Un motif manquant est nommé plutôt qu'ignoré — le contrat autorise
 * une mesure écartée sans motif, et taire ce cas laisserait un total sans
 * explication.
 */
export function summarizeExclusions(points: readonly ChartPoint[]): ExclusionSummary {
  const excluded = points.filter((point) => point.excluded);
  const counts = new Map<string, number>();
  for (const point of excluded) {
    const reason = point.exclusionReason ?? UNSPECIFIED_EXCLUSION_REASON;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return {
    total: excluded.length,
    // Les points sont déjà triés par horodatage croissant : les bornes de la
    // plage se lisent donc aux extrémités, sans retrier.
    reasons: [...counts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count),
    firstAt: excluded[0]?.isoTimestamp ?? null,
    lastAt: excluded.at(-1)?.isoTimestamp ?? null,
  };
}
