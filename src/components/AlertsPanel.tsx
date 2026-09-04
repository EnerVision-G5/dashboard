/**
 * Panneau « Alertes actives » (EV-17).
 *
 * Une alerte constate ce qui vient de se produire ; une recommandation propose
 * une action sur ce qui va se produire. Les deux partagent la même échelle de
 * gravité — à dessein, dit le contrat — mais pas la même colonne : mêler un
 * constat et un conseil dans une seule liste obligerait le lecteur à
 * distinguer, à chaque ligne, ce qu'il doit croire de ce qu'il doit faire.
 *
 * Le tri par gravité est fait ici, contrairement aux recommandations où l'API
 * l'impose : `GET /alerts` sert un journal, du plus récent au plus ancien.
 * C'est l'ordre d'un historique, pas celui d'une liste d'incidents à traiter.
 *
 * `value` et `threshold` ne sont pas garantis par le contrat. Quand les deux
 * sont là, l'écart est ce qui rend l'alerte lisible — « 812 kW pour un seuil
 * de 500 » dit en un coup d'œil ce que le message décrit en une phrase.
 */

import type { Alert, AlertSeverity, AlertType } from "../api/alerts";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface AlertsPanelProps {
  alerts: readonly Alert[];
  isLoading: boolean;
  error: string | null;
  /** Profondeur de la fenêtre lue, affichée pour situer la liste. */
  windowHours: number;
}

/** Habillage de chaque gravité : surface, badge, et libellé écrit. */
const SEVERITIES: Record<
  AlertSeverity,
  { surface: string; badge: string; label: string }
> = {
  low: {
    surface: "border-ardoise-200 bg-white",
    badge: "bg-ardoise-100 text-ardoise-700",
    label: "faible",
  },
  medium: {
    surface: "border-ardoise-300 bg-ardoise-50",
    badge: "bg-ardoise-200 text-ardoise-800",
    label: "moyenne",
  },
  high: {
    surface: "border-estimation-400 bg-estimation-50",
    badge: "bg-estimation-200 text-estimation-900",
    label: "élevée",
  },
  critical: {
    surface: "border-alerte-300 bg-alerte-50",
    badge: "bg-alerte-200 text-alerte-900",
    label: "critique",
  },
};

/** Les cinq natures d'anomalie énumérées par le contrat, en français. */
const TYPES: Record<AlertType, string> = {
  spike: "pic de consommation",
  threshold: "seuil dépassé",
  anomaly: "anomalie",
  outage: "coupure",
  sensor: "capteur",
};

function kilowatts(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kW`;
}

/** Valeur relevée et seuil franchi, quand la source les sert. */
function Numbers({ alert }: { alert: Alert }) {
  const value = alert.value ?? null;
  const threshold = alert.threshold ?? null;

  if (value === null && threshold === null) {
    return null;
  }
  return (
    <p data-valeur className="mt-0.5 text-corps text-ardoise-700">
      {value !== null && `Relevé ${kilowatts(value)}`}
      {value !== null && threshold !== null && " · "}
      {threshold !== null && `seuil ${kilowatts(threshold)}`}
    </p>
  );
}

function Item({ alert }: { alert: Alert }) {
  const { surface, badge, label } = SEVERITIES[alert.severity];

  return (
    <li className={`rounded-controle border px-3 py-2 ${surface}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-controle px-2 py-0.5 text-annexe font-semibold tracking-wide uppercase ${badge}`}
          >
            {label}
          </span>
          <span className="text-annexe tracking-wide text-ardoise-600 uppercase">
            {TYPES[alert.type]}
          </span>
        </div>
        <time
          dateTime={alert.timestamp}
          data-valeur
          className="text-corps text-ardoise-600"
        >
          {new Date(alert.timestamp).toLocaleString("fr-FR")}
        </time>
      </div>
      {/* Le message vient de la source, l'API le relaie sans le réécrire :
          l'écran fait de même. */}
      <p className="mt-1 text-corps text-ardoise-900">{alert.message}</p>
      <Numbers alert={alert} />
    </li>
  );
}

export function AlertsPanel({ alerts, isLoading, error, windowHours }: AlertsPanelProps) {
  return (
    <Card title="Alertes actives" description={`Sur les ${windowHours} dernières heures`}>
      {isLoading && <LoadingState>Lecture des alertes du site…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="Alertes indisponibles">{error}</ErrorState>
      )}

      {!isLoading && error === null && alerts.length === 0 && (
        // Une liste vide est une bonne nouvelle, mais elle ne doit pas se
        // confondre avec un flux tombé : d'où une phrase, et pas un blanc.
        <EmptyState detail="La source ne publie que les alertes actives ; une alerte résolue quitte sa réponse, l'API en garde le journal.">
          Aucune alerte sur la fenêtre.
        </EmptyState>
      )}

      {!isLoading && error === null && alerts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <Item key={alert.alert_id} alert={alert} />
          ))}
        </ul>
      )}
    </Card>
  );
}
