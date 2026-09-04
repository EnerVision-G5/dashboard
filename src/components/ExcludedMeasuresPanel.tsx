/**
 * Panneau « Mesures écartées et pannes de capteur » (EV-52).
 *
 * Deux choses que le ticket demandait d'afficher, et qui n'avaient aucune
 * source avant le contrat 1.5.0 :
 *
 *   - les mesures **écartées des agrégats**, avec leur motif : elles restent
 *     servies par l'API et tracées sur le graphique, mais elles ne comptent
 *     pas dans les moyennes. Le résumé vient des mesures déjà chargées pour le
 *     graphique — aucune requête de plus ;
 *   - l'**historique des pannes de capteur**, servi par
 *     `GET /sites/{id}/sensors/history` : un épisode par panne, avec son début,
 *     sa fin, et le capteur concerné.
 *
 * Le résumé ne liste pas les 1 440 mesures d'une journée : ce qui se décide,
 * c'est combien ont été retirées, pourquoi, et sur quelle plage.
 */

import type { SensorFailure, SensorName } from "../api/sensors";
import type { ExclusionSummary } from "../lib/series";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface ExcludedMeasuresPanelProps {
  /** Résumé des mesures écartées de la fenêtre affichée. */
  exclusions: ExclusionSummary;
  /** Épisodes de panne, le plus récent d'abord. */
  failures: readonly SensorFailure[];
  /** Vrai tant que les mesures de la fenêtre ne sont pas arrivées. */
  isLoading: boolean;
  /** Erreur de la lecture de l'historique des pannes. */
  failuresError: string | null;
  /** Profondeur de la fenêtre examinée, en heures. */
  windowHours: number;
}

/** Libellés français des capteurs nommés par le contrat. */
const SENSOR_LABELS: Record<SensorName, string> = {
  consumption: "consommation",
  electrical: "électrique",
  temperature: "température",
  humidity: "humidité",
  network: "réseau",
};

function moment(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

/** Un épisode de panne, tel que l'API le borne. */
function Failure({ failure }: { failure: SensorFailure }) {
  const fin = failure.ended_at ?? null;

  return (
    <li className="border-b border-ardoise-100 py-2 last:border-b-0">
      <p className="font-medium text-ardoise-900">
        Capteur {SENSOR_LABELS[failure.capteur]}
        {failure.ongoing && <span className="text-alerte-900"> · panne en cours</span>}
      </p>
      <p className="text-ardoise-600">
        Constatée le <time dateTime={failure.started_at}>{moment(failure.started_at)}</time>
        {fin === null ? (
          // `ongoing` et une fin nulle disent la même chose ; on ne fabrique
          // pas de date de rétablissement.
          ", pas encore rétablie"
        ) : (
          <>
            , rétablie le <time dateTime={fin}>{moment(fin)}</time>
          </>
        )}
        .
      </p>
      {failure.failing_until !== null && failure.failing_until !== undefined && (
        <p className="text-ardoise-500">
          Rétablissement annoncé par la source pour le{" "}
          <time dateTime={failure.failing_until}>{moment(failure.failing_until)}</time>.
        </p>
      )}
    </li>
  );
}

export function ExcludedMeasuresPanel({
  exclusions,
  failures,
  isLoading,
  failuresError,
  windowHours,
}: ExcludedMeasuresPanelProps) {
  return (
    <Card
      title="Mesures écartées et pannes de capteur"
      description={`Sur les ${windowHours} dernières heures`}
    >
      {isLoading ? (
        <LoadingState>Lecture des mesures de la fenêtre…</LoadingState>
      ) : (
        <>
          <h3 className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase">
            Mesures écartées des agrégats
          </h3>
          {exclusions.total === 0 ? (
            <p className="mt-2 text-corps text-ardoise-600">
              Aucune mesure écartée sur la fenêtre.
            </p>
          ) : (
            <>
              <p className="mt-2 text-corps text-ardoise-900">
                <span data-valeur className="font-semibold">
                  {exclusions.total}
                </span>{" "}
                mesure(s) écartée(s), du{" "}
                {exclusions.firstAt !== null && (
                  <time dateTime={exclusions.firstAt}>{moment(exclusions.firstAt)}</time>
                )}{" "}
                au{" "}
                {exclusions.lastAt !== null && (
                  <time dateTime={exclusions.lastAt}>{moment(exclusions.lastAt)}</time>
                )}
                .
              </p>
              <ul className="mt-1 flex flex-col gap-0.5 text-corps text-ardoise-600">
                {exclusions.reasons.map(({ reason, count }) => (
                  <li key={reason}>
                    {count} × {reason}
                  </li>
                ))}
              </ul>
              {/* Elles restent sur le graphique : les retirer de l'affichage
                  reviendrait à lisser un incident. */}
              <p className="mt-1 text-corps text-ardoise-500">
                Ces mesures restent tracées sur le graphique, mais ne comptent pas dans les
                moyennes de l'API.
              </p>
            </>
          )}

          <h3 className="mt-4 text-annexe font-medium tracking-wide text-ardoise-600 uppercase">
            Historique des pannes
          </h3>
          {failuresError !== null ? (
            <div className="mt-2">
              <ErrorState title="Historique des pannes indisponible">
                {failuresError}
              </ErrorState>
            </div>
          ) : failures.length === 0 ? (
            <div className="mt-2">
              <EmptyState>Aucune panne de capteur enregistrée pour ce site.</EmptyState>
            </div>
          ) : (
            <ul className="mt-1 text-corps">
              {failures.map((failure) => (
                <Failure
                  key={`${failure.capteur}-${failure.started_at}`}
                  failure={failure}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
