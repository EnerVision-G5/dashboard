/**
 * Fenêtre de temps interrogée par l'écran EV-16.
 *
 * Les bornes sont toujours produites en ISO 8601 UTC, forme attendue par les
 * paramètres `start_time` et `end_time` du contrat.
 */

/** Profondeur d'historique affichée par défaut. */
export const DEFAULT_WINDOW_HOURS = 24;

const MS_PER_HOUR = 60 * 60 * 1000;

/** Bornes d'une fenêtre de mesures, en ISO 8601 UTC. */
export interface TimeWindow {
  startTime: string;
  endTime: string;
}

/**
 * Construit la fenêtre des `hours` dernières heures terminant à `now`.
 *
 * `now` est un paramètre plutôt qu'un appel implicite à l'horloge pour que la
 * fonction reste testable et que le rechargement soit déclenché par le
 * composant, pas par un effet de bord caché.
 */
export function recentWindow(now: Date, hours: number = DEFAULT_WINDOW_HOURS): TimeWindow {
  const end = now.getTime();
  return {
    startTime: new Date(end - hours * MS_PER_HOUR).toISOString(),
    endTime: new Date(end).toISOString(),
  };
}

/** Durées proposées en un clic par le sélecteur de période (EV-53). */
export const QUICK_RANGES: { label: string; hours: number }[] = [
  { label: "6 h", hours: 6 },
  { label: "24 h", hours: 24 },
  { label: "3 j", hours: 72 },
  { label: "7 j", hours: 168 },
];

/**
 * Profondeur maximale réellement servie, en heures.
 *
 * La pagination des mesures est bornée : 20 pages de 1 000 éléments, soit
 * 20 000 mesures, c'est-à-dire environ 13 jours à une mesure par minute.
 * Au-delà, la série serait tronquée **sans que rien ne le dise** — le
 * sélecteur avertit donc plutôt que de laisser lire un graphique incomplet
 * comme s'il était entier.
 */
export const MAX_COVERED_HOURS = Math.floor((20 * 1000) / 60);

/** Profondeur d'une fenêtre, en heures. Négative si les bornes sont inversées. */
export function windowHours({ startTime, endTime }: TimeWindow): number {
  return (Date.parse(endTime) - Date.parse(startTime)) / MS_PER_HOUR;
}

/** Raison pour laquelle une fenêtre est refusée, `null` si elle est valable. */
export type WindowProblem = "illisible" | "inversee" | "vide";

/**
 * Vérifie une fenêtre saisie à la main.
 *
 * Le contrat refuse des bornes inversées par un 422 : mieux vaut le dire avant
 * l'appel que traduire son message ensuite. Une fenêtre de durée nulle est
 * refusée aussi — elle ne renverrait qu'un point, ce qui n'est pas un
 * historique.
 */
export function windowProblem(window: TimeWindow): WindowProblem | null {
  const hours = windowHours(window);
  if (Number.isNaN(hours)) {
    return "illisible";
  }
  if (hours < 0) {
    return "inversee";
  }
  return hours === 0 ? "vide" : null;
}

/**
 * Fenêtre à demander aux prédictions pour une fenêtre de mesures donnée.
 *
 * Deux cas, et ils ne se confondent pas :
 *
 *   - la fenêtre **touche le présent** : on veut voir la prévision à venir, et
 *     elle est donc prolongée de son horizon au-delà de la borne haute ;
 *   - la fenêtre est **entièrement passée** : les prédictions utiles sont
 *     celles qui ont été archivées pendant cette période, et la prolonger
 *     ramènerait des heures que l'écran ne montre pas.
 */
export function predictionWindowFor(
  readings: TimeWindow,
  now: Date,
  horizonHours: number = DEFAULT_WINDOW_HOURS,
): TimeWindow {
  const end = Date.parse(readings.endTime);
  if (end < now.getTime()) {
    return readings;
  }
  return {
    startTime: readings.startTime,
    endTime: new Date(end + horizonHours * MS_PER_HOUR).toISOString(),
  };
}

/**
 * Construit la fenêtre des `hours` heures à venir à partir de `now`.
 *
 * Les prédictions portent sur l'avenir : la fenêtre des mesures, qui remonte
 * dans le passé, ne les rencontrerait jamais.
 */
export function forecastWindow(
  now: Date,
  hours: number = DEFAULT_WINDOW_HOURS,
): TimeWindow {
  const start = now.getTime();
  return {
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + hours * MS_PER_HOUR).toISOString(),
  };
}
