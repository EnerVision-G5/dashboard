/**
 * Synthèse de la fraîcheur et de la qualité des données (EV-18).
 *
 * Logique volontairement pure et hors de React : ce sont des règles de lecture
 * du contrat, elles se testent sans DOM et se relisent sans JSX.
 *
 * **Aucun seuil n'est décidé ici.** Le contrat 1.5.0 publie chaque seuil avec
 * l'indicateur qu'il qualifie — `stale_threshold_seconds` pour la fraîcheur,
 * `threshold` pour la part dégradée — et l'API pose elle-même les booléens
 * `is_stale`, `exceeds_threshold` et la synthèse `overall` des capteurs. Le
 * dashboard les relit ; il ne les recalcule pas, sans quoi un seuil révisé
 * côté exploitation devrait être suivi à deux endroits.
 *
 * Un piège du contrat est traité explicitement : `data_quality` vaut `good`
 * par défaut, donc une fenêtre que l'ETL n'a pas encore qualifiée affiche 0 %
 * de dégradation sans être saine pour autant. `qualified_ratio` le dit, et une
 * fenêtre non qualifiée est signalée comme telle plutôt que présentée comme
 * propre — c'est exactement ce que le ticket cherche à empêcher.
 */

import type { SiteIndicators } from "../api/indicators";
import type { SensorHealth, SensorName } from "../api/sensors";

/** Gravité, sur le vocabulaire du contrat et du ticket. */
export type HealthLevel = "ok" | "degraded" | "critical";

/** Nature d'un constat, pour regrouper à l'affichage sans relire le texte. */
export type FindingKind =
  | "no_data"
  | "stale"
  | "quality"
  | "unqualified"
  | "sensor_failure"
  | "network";

/** Un constat sur un site, prêt à afficher. */
export interface HealthFinding {
  siteId: string;
  /** Nom lisible du site, ou son identifiant à défaut. */
  siteLabel: string;
  kind: FindingKind;
  level: "degraded" | "critical";
  message: string;
}

/** Ce que le bandeau affiche. */
export interface DataHealth {
  /** Le plus grave des constats, `ok` s'il n'y en a aucun. */
  level: HealthLevel;
  /** Constats, les plus graves d'abord. */
  findings: HealthFinding[];
  /** Nombre de sites réellement examinés. */
  sitesChecked: number;
  /** Horodatage de calcul le plus récent servi par l'API, `null` si aucun. */
  generatedAt: string | null;
}

/** Libellés français des capteurs nommés par le contrat. */
const SENSOR_LABELS: Record<SensorName, string> = {
  consumption: "consommation",
  electrical: "électrique",
  temperature: "température",
  humidity: "humidité",
  network: "réseau",
};

const LEVEL_RANK: Record<HealthLevel, number> = { ok: 0, degraded: 1, critical: 2 };

/**
 * Âge en toutes lettres.
 *
 * Les secondes ne sont affichées que sous la minute : « 4 512 s » demande un
 * calcul mental à qui veut seulement savoir si la donnée est vieille.
 */
export function formatAge(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) {
    return `${total} s`;
  }
  const minutes = Math.floor(total / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Part en pourcentage, arrondie à l'entier. */
export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

/** Le plus grave de deux niveaux. */
function worst(current: HealthLevel, candidate: HealthLevel): HealthLevel {
  return LEVEL_RANK[candidate] > LEVEL_RANK[current] ? candidate : current;
}

/** Constats tirés des indicateurs de confiance d'un site. */
function fromIndicators(indicators: SiteIndicators, siteLabel: string): HealthFinding[] {
  const { site_id: siteId, ingestion, quality } = indicators;
  const base = { siteId, siteLabel };
  const found: HealthFinding[] = [];

  if (ingestion.is_stale) {
    // Un site sans aucune mesure n'est pas « en retard » : il est muet, et
    // c'est plus grave. Le contrat les distingue par `last_measure_at`.
    if (ingestion.last_measure_at === null) {
      found.push({
        ...base,
        kind: "no_data",
        level: "critical",
        message: `${siteLabel} n'a aucune mesure sur la fenêtre.`,
      });
    } else {
      const age =
        ingestion.measure_age_seconds === null
          ? "un âge inconnu"
          : formatAge(ingestion.measure_age_seconds);
      const seuil = formatAge(ingestion.stale_threshold_seconds);
      found.push({
        ...base,
        kind: "stale",
        level: "degraded",
        message: `${siteLabel} : dernière mesure il y a ${age}, au-delà du seuil de ${seuil}.`,
      });
    }
  }

  if (quality.exceeds_threshold) {
    found.push({
      ...base,
      kind: "quality",
      level: "degraded",
      message: `${siteLabel} : ${formatRatio(quality.degraded_ratio)} de mesures dégradées, seuil ${formatRatio(quality.threshold)}.`,
    });
  }

  // Rien de qualifié alors que des mesures existent : la part dégradée
  // affichée ne veut rien dire, et surtout pas que le site est sain.
  if (quality.total > 0 && quality.qualified_ratio === 0) {
    found.push({
      ...base,
      kind: "unqualified",
      level: "degraded",
      message: `${siteLabel} : aucune des ${quality.total} mesures de la fenêtre n'a été qualifiée par l'ETL, leur qualité est inconnue.`,
    });
  }

  if (quality.sensor_failure > 0) {
    found.push({
      ...base,
      kind: "sensor_failure",
      level: "degraded",
      message: `${siteLabel} : ${quality.sensor_failure} mesure(s) attribuée(s) à une panne de capteur.`,
    });
  }

  return found;
}

/** Constats tirés de l'état des capteurs du site affiché. */
function fromSensors(sensors: readonly SensorHealth[], siteLabel: string): HealthFinding[] {
  if (sensors.length === 0) {
    return [];
  }
  const base = { siteId: sensors[0].site_id, siteLabel };
  const found: HealthFinding[] = [];

  // `overall` est la synthèse de l'API : `critical` y vaut perte réseau, ce
  // que le ticket appelle « panne réseau ». Elle est identique sur chaque
  // ligne, donc lue une seule fois.
  if (sensors[0].overall === "critical") {
    found.push({
      ...base,
      kind: "network",
      level: "critical",
      message: `${siteLabel} : perte réseau, les mesures n'arrivent plus.`,
    });
  }

  for (const sensor of sensors) {
    if (sensor.statut !== "failing") {
      continue;
    }
    // `failing_until` n'est pas requis au contrat : absent et nul disent la
    // même chose, la source n'annonce aucune date de rétablissement.
    const annonce = sensor.failing_until ?? null;
    const retour =
      annonce === null
        ? "sans date de rétablissement annoncée"
        : `rétablissement annoncé le ${new Date(annonce).toLocaleString("fr-FR")}`;
    found.push({
      ...base,
      kind: "sensor_failure",
      level: "degraded",
      message: `${siteLabel} : capteur ${SENSOR_LABELS[sensor.capteur]} en panne, ${retour}.`,
    });
  }

  return found;
}

interface BuildOptions {
  /** Indicateurs de tout le parc. */
  indicators: readonly SiteIndicators[];
  /** Capteurs du site affiché ; le contrat n'en publie pas pour le parc. */
  sensors: readonly SensorHealth[];
  /** Nom lisible d'un site, l'identifiant servant de repli. */
  labelOf?: (siteId: string) => string;
}

/**
 * Assemble le constat affiché par le bandeau.
 *
 * Les constats les plus graves passent devant : sur sept sites, celui qui ne
 * mesure plus rien doit se lire avant celui dont 12 % des mesures sont
 * dégradées. Le tri est stable, l'ordre des sites servi par l'API est donc
 * conservé à gravité égale.
 */
export function buildDataHealth({
  indicators,
  sensors,
  labelOf = (siteId) => siteId,
}: BuildOptions): DataHealth {
  const findings = [
    ...indicators.flatMap((site) => fromIndicators(site, labelOf(site.site_id))),
    ...fromSensors(sensors, sensors.length > 0 ? labelOf(sensors[0].site_id) : ""),
  ];

  return {
    level: findings.reduce<HealthLevel>((current, found) => worst(current, found.level), "ok"),
    findings: [...findings].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]),
    sitesChecked: indicators.length,
    generatedAt: indicators.reduce<string | null>(
      (latest, site) =>
        latest === null || site.generated_at > latest ? site.generated_at : latest,
      null,
    ),
  };
}
