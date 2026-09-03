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
