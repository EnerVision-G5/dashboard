/**
 * Choix de la grandeur tracée par le graphique.
 *
 * Même forme que le sélecteur de période, juste au-dessus : ce sont deux
 * réglages du même graphique, et les présenter différemment obligerait à
 * apprendre deux fois la même chose.
 *
 * Le bouton actif porte `aria-pressed`, et non une simple couleur : c'est le
 * seul repère qu'un lecteur d'écran puisse annoncer, et la règle du design
 * system veut qu'une information ne soit jamais portée par la couleur seule.
 * Le poids du texte la double.
 */

import type { Measure, MeasureKey } from "../lib/measures";
import { MEASURES } from "../lib/measures";

interface MeasurePickerProps {
  /** Grandeur actuellement tracée. */
  measure: Measure;
  onSelect: (key: MeasureKey) => void;
}

const BASE = [
  "inline-flex min-h-7 items-center rounded-controle border px-3 py-1 text-corps",
  "transition-colors duration-150 ease-etat",
].join(" ");

const ACTIF = "border-mesure-700 bg-mesure-50 font-semibold text-mesure-900";
const INACTIF =
  "border-ardoise-300 bg-white font-medium text-ardoise-700 hover:bg-ardoise-100";

export function MeasurePicker({ measure, onSelect }: MeasurePickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        id="grandeur-tracee"
        className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase"
      >
        Grandeur
      </span>
      {/* `group` nommé par le libellé : les six boutons forment un seul
          réglage, et un lecteur d'écran doit l'annoncer comme tel. */}
      <div role="group" aria-labelledby="grandeur-tracee" className="flex flex-wrap gap-2">
        {MEASURES.map((candidate) => {
          const actif = candidate.key === measure.key;
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={actif}
              onClick={() => onSelect(candidate.key)}
              className={`${BASE} ${actif ? ACTIF : INACTIF}`}
            >
              {candidate.label}
              {candidate.unit !== "" && (
                <span className="ml-1 text-ardoise-500">({candidate.unit})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
