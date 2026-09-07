/**
 * Sélecteur de période de l'historique (EV-53).
 *
 * Deux façons de choisir, parce qu'elles répondent à deux besoins :
 *
 *   - les **durées rapides** couvrent le cas courant — « les dernières
 *     24 heures » — et se recalculent à chaque application pour finir à
 *     l'instant présent ;
 *   - les **bornes explicites** servent l'analyse d'un incident daté, que le
 *     ticket demande nommément.
 *
 * La saisie est validée avant l'appel. Le contrat refuse des bornes inversées
 * par un 422, et traduire ce refus après coup serait moins clair que de
 * l'empêcher : l'utilisateur sait ce qu'il a écrit, pas ce que l'API en pense.
 *
 * Les champs partent de la fenêtre appliquée et vivent ensuite leur vie. Quand
 * la fenêtre change par un autre chemin — un bouton de durée rapide —, c'est
 * l'écran qui remonte ce composant par sa clé plutôt que ce composant qui
 * synchronise son état dans un effet : une prop recopiée dans un état est une
 * source de vérité en double, et deux vérités finissent toujours par diverger.
 *
 * Un avertissement — et non un blocage — signale une fenêtre plus profonde que
 * ce que la pagination couvre. La série serait alors tronquée sans le dire, et
 * un graphique incomplet lu comme un graphique entier est pire qu'un graphique
 * refusé.
 */

import { useState } from "react";
import type { TimeWindow } from "../lib/timeWindow";
import {
  MAX_COVERED_HOURS,
  QUICK_RANGES,
  recentWindow,
  windowHours,
  windowProblem,
} from "../lib/timeWindow";
import { Button } from "../ui/Button";

interface TimeRangePickerProps {
  /** Fenêtre actuellement appliquée. */
  window: TimeWindow;
  /** Appelé avec la nouvelle fenêtre, une fois validée. */
  onApply: (window: TimeWindow) => void;
  /** Injectable pour que les tests figent l'instant de référence. */
  now?: () => Date;
}

/** Messages de refus, dans les mots de l'utilisateur. */
const PROBLEMS: Record<NonNullable<ReturnType<typeof windowProblem>>, string> = {
  illisible: "Les deux dates doivent être renseignées.",
  inversee: "La date de fin doit suivre la date de début.",
  vide: "La période doit couvrir au moins quelques minutes.",
};

/**
 * ISO 8601 UTC vers la valeur attendue par `datetime-local`.
 *
 * Le champ natif travaille en heure locale et sans fuseau : on lui donne donc
 * l'instant décalé, faute de quoi il afficherait une heure UTC en la
 * présentant comme locale.
 */
function toLocalInput(iso: string): string {
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) {
    return "";
  }
  const offset = moment.getTimezoneOffset() * 60 * 1000;
  return new Date(moment.getTime() - offset).toISOString().slice(0, 16);
}

/** Valeur d'un `datetime-local` vers ISO 8601 UTC. */
function toIso(local: string): string {
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function TimeRangePicker({
  window,
  onApply,
  now = () => new Date(),
}: TimeRangePickerProps) {
  const [start, setStart] = useState(() => toLocalInput(window.startTime));
  const [end, setEnd] = useState(() => toLocalInput(window.endTime));
  const [problem, setProblem] = useState<string | null>(null);

  function applyQuick(hours: number): void {
    setProblem(null);
    onApply(recentWindow(now(), hours));
  }

  function applyCustom(): void {
    const candidate: TimeWindow = { startTime: toIso(start), endTime: toIso(end) };
    const found = windowProblem(candidate);
    if (found !== null) {
      setProblem(PROBLEMS[found]);
      return;
    }
    setProblem(null);
    onApply(candidate);
  }

  const hours = windowHours(window);
  const tooDeep = !Number.isNaN(hours) && hours > MAX_COVERED_HOURS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase">
          Période
        </span>
        {QUICK_RANGES.map((range) => (
          <Button
            key={range.hours}
            variant="secondaire"
            size="sm"
            onClick={() => applyQuick(range.hours)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-corps text-ardoise-700">
          Début
          <input
            type="datetime-local"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className="min-h-9 rounded-controle border border-ardoise-300 bg-white px-3 py-1 text-corps text-ardoise-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-corps text-ardoise-700">
          Fin
          <input
            type="datetime-local"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className="min-h-9 rounded-controle border border-ardoise-300 bg-white px-3 py-1 text-corps text-ardoise-900"
          />
        </label>
        <Button variant="secondaire" onClick={applyCustom}>
          Appliquer
        </Button>
      </div>

      {problem !== null && (
        // Une saisie refusée interrompt : l'utilisateur attend un graphique et
        // ne l'aura pas tant qu'il n'a pas corrigé.
        <p role="alert" className="text-corps text-alerte-900">
          {problem}
        </p>
      )}

      {tooDeep && (
        <p className="text-corps text-estimation-800">
          Période de {Math.round(hours / 24)} jours : au-delà de{" "}
          {Math.floor(MAX_COVERED_HOURS / 24)} jours, la pagination des mesures ne couvre
          pas toute la fenêtre et le graphique peut être incomplet.
        </p>
      )}
    </div>
  );
}
