/**
 * Grandeurs traçables d'une mesure.
 *
 * Le graphique ne montrait que la consommation, alors que chaque
 * `EnergyReadingOut` porte six grandeurs. Les autres servent à répondre à une
 * question que la seule consommation laisse ouverte : une chute de puissance
 * vient-elle d'un arrêt de production, d'une baisse de tension, ou d'un capteur
 * qui a lâché ?
 *
 * Une seule grandeur est **prédite** : la consommation. Le modèle ne prévoit ni
 * la température ni la tension, et le contrat ne publie qu'un
 * `predicted_consumption_kw`. Le descripteur porte donc cette information, et
 * l'écran s'y conforme au lieu de tracer une courbe prédite vide.
 *
 * Les unités et les décimales viennent d'ici, pas des composants : c'est ce qui
 * garantit qu'une tension s'affiche partout avec la même précision.
 */

import type { EnergyReading } from "../api/readings";

/** Clé d'une grandeur, stable et utilisable dans une adresse. */
export type MeasureKey =
  | "consumption"
  | "voltage"
  | "current"
  | "temperature"
  | "humidity"
  | "powerFactor";

/** Ce qu'il faut savoir d'une grandeur pour la lire et la tracer. */
export interface Measure {
  key: MeasureKey;
  /** Nom affiché dans le sélecteur et la légende. */
  label: string;
  /** Unité, telle qu'elle accompagne la valeur. Vide si la grandeur n'en a pas. */
  unit: string;
  /** Décimales utiles, selon la précision de la grandeur. */
  digits: number;
  /** Champ du contrat dont la valeur est lue. */
  field: keyof EnergyReading;
  /**
   * Vrai si le modèle prédit cette grandeur.
   *
   * Seule la consommation l'est. Ailleurs, la courbe de prédiction n'est pas
   * masquée par choix esthétique : elle n'existe pas.
   */
  predicted: boolean;
}

/**
 * Les six grandeurs, dans l'ordre du sélecteur.
 *
 * La consommation vient d'abord : c'est le sujet du produit, et la seule que
 * le modèle prévoit.
 */
export const MEASURES: Measure[] = [
  {
    key: "consumption",
    label: "Consommation",
    unit: "kW",
    digits: 0,
    field: "consumption_kw",
    predicted: true,
  },
  {
    key: "voltage",
    label: "Tension",
    unit: "V",
    digits: 1,
    field: "voltage_v",
    predicted: false,
  },
  {
    key: "current",
    label: "Intensité",
    unit: "A",
    digits: 1,
    field: "current_a",
    predicted: false,
  },
  {
    key: "temperature",
    label: "Température",
    unit: "°C",
    digits: 1,
    field: "temperature_celsius",
    predicted: false,
  },
  {
    key: "humidity",
    label: "Humidité",
    unit: "%",
    digits: 1,
    field: "humidity_percent",
    predicted: false,
  },
  {
    key: "powerFactor",
    // Sans unité : c'est un rapport, et écrire « 0,95 ø » ou « 0,95 pf »
    // inventerait une notation que personne n'utilise.
    label: "Facteur de puissance",
    unit: "",
    digits: 2,
    field: "power_factor",
    predicted: false,
  },
];

/** Grandeur affichée par défaut : le sujet du produit. */
export const DEFAULT_MEASURE: MeasureKey = "consumption";

const BY_KEY = new Map<MeasureKey, Measure>(
  MEASURES.map((measure) => [measure.key, measure]),
);

/**
 * Descripteur d'une grandeur, par sa clé.
 *
 * Retombe sur la consommation devant une clé inconnue : la clé peut venir de
 * l'adresse, donc d'une main humaine, et une faute de frappe ne doit pas vider
 * l'écran.
 */
export function measureOf(key: string | null | undefined): Measure {
  return (key !== null && key !== undefined ? BY_KEY.get(key as MeasureKey) : undefined)
    ?? BY_KEY.get(DEFAULT_MEASURE)!;
}

/** Valeur d'une grandeur dans une mesure, `null` si la source ne l'a pas servie. */
export function readMeasure(reading: EnergyReading, measure: Measure): number | null {
  const valeur = reading[measure.field];
  return typeof valeur === "number" ? valeur : null;
}

/**
 * Libellé de la série mesurée pour une grandeur.
 *
 * La consommation garde son libellé historique — « Consommation réelle (kW) » —
 * parce que la légende du graphique le porte depuis EV-16 et que la recette y
 * fait référence.
 */
export function seriesLabel(measure: Measure): string {
  return measure.key === "consumption"
    ? "Consommation réelle (kW)"
    : `${measure.label}${measure.unit === "" ? "" : ` (${measure.unit})`}`;
}

/** Valeur formatée avec son unité, ou un tiret cadratin si elle manque. */
export function formatMeasure(value: number | null, measure: Measure): string {
  if (value === null) {
    return "—";
  }
  const nombre = value.toLocaleString("fr-FR", {
    minimumFractionDigits: measure.digits,
    maximumFractionDigits: measure.digits,
  });
  return measure.unit === "" ? nombre : `${nombre} ${measure.unit}`;
}
