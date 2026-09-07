/**
 * Panneau « Ingestion des mesures » (EV-52).
 *
 * Répond à une question d'exploitation : les mesures arrivent-elles encore, et
 * si non, où la chaîne s'est-elle interrompue ? Le contrat 1.5.0 distingue
 * deux instants que rien ne permettait de séparer avant lui :
 *
 *   - `last_measure_at`, l'heure à laquelle la mesure a été prise ;
 *   - `last_ingested_at`, l'heure à laquelle elle a été écrite en base.
 *
 * L'écart entre les deux, `ingestion_lag_seconds`, désigne le coupable : un
 * âge de mesure élevé avec un délai d'ingestion faible dit que la source s'est
 * tue ; l'inverse dit que la collecte a pris du retard sur une source qui,
 * elle, produisait bien.
 *
 * Le verdict `is_stale` et son seuil viennent tous deux de l'API : le
 * dashboard n'en décide pas, il les affiche — le seuil compris, pour qu'un
 * exploitant sache à quoi le retard est comparé.
 */

import type { CollectorState, IngestionIndicator } from "../api/indicators";
import { formatAge } from "../lib/dataHealth";
import { Card } from "../ui/Card";
import { Disclosure } from "../ui/Disclosure";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface IngestionPanelProps {
  ingestion: IngestionIndicator | null;
  isLoading: boolean;
  error: string | null;
}

/** Date et heure locales, ou un tiret si la source n'a rien à dire. */
function Moment({ iso }: { iso: string | null }) {
  if (iso === null) {
    return <>—</>;
  }
  return <time dateTime={iso}>{new Date(iso).toLocaleString("fr-FR")}</time>;
}

/** Une ligne « libellé : valeur », le vocabulaire commun du panneau. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-ardoise-100 py-1.5 last:border-b-0">
      <dt className="text-ardoise-600">{label}</dt>
      <dd data-valeur className="font-medium text-ardoise-900">
        {children}
      </dd>
    </div>
  );
}

/**
 * Ce que le collecteur dit de lui-même.
 *
 * Bloc affiché seulement quand l'API en sert un : `collector` est nul tant que
 * la collecte n'a jamais tourné sur ce site, et inventer une ligne « aucun
 * échec » dans ce cas serait rassurant à tort.
 */
function Collector({ collector }: { collector: CollectorState }) {
  const enPanne = collector.consecutive_failures > 0;

  return (
    <div className="mt-4">
      {/* Replié par défaut : on vient y chercher une cause, et le reste du
          temps ces six lignes repoussent les panneaux voisins vers le bas.
          Ouvert d'emblée quand le collecteur échoue, puisque c'est alors
          l'information la plus utile de la carte. */}
      <Disclosure
        summary={`Collecteur (${collector.source === "poller" ? "collecte continue" : "reprise"})`}
        defaultOpen={enPanne}
      >
      <dl className="text-corps">
        <Line label="Dernier essai">
          <Moment iso={collector.last_attempt_at} />
        </Line>
        <Line label="Dernier succès">
          <Moment iso={collector.last_success_at} />
        </Line>
        <Line label="Lignes au dernier essai abouti">{collector.last_rows}</Line>
        {collector.last_data_lag_seconds !== null && (
          <Line label="Retard de la source, vu du collecteur">
            {formatAge(collector.last_data_lag_seconds)}
          </Line>
        )}
        <Line label="Échecs consécutifs">
          <span className={enPanne ? "text-alerte-900" : undefined}>
            {collector.consecutive_failures}
          </span>
        </Line>
      </dl>

      {/* La dernière erreur est conservée par l'API après un succès : elle dit
          de quoi ce site relève, pas qu'il est en panne maintenant. La
          présenter comme une alerte serait donc faux. */}
      {collector.last_error !== null && (
        <p className="mt-2 text-corps text-ardoise-600">
          {enPanne ? "Erreur en cours" : "Dernière erreur connue, depuis résolue"} :{" "}
          {collector.last_error}
        </p>
      )}
      </Disclosure>
    </div>
  );
}

export function IngestionPanel({ ingestion, isLoading, error }: IngestionPanelProps) {
  return (
    <Card title="Ingestion des mesures">
      {isLoading && <LoadingState>Lecture de l'état de l'ingestion…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="État de l'ingestion indisponible">{error}</ErrorState>
      )}

      {!isLoading && error === null && ingestion === null && (
        <EmptyState detail="Le site n'a peut-être jamais été collecté.">
          Aucun indicateur d'ingestion pour ce site.
        </EmptyState>
      )}

      {!isLoading && error === null && ingestion !== null && (
        <>
          <dl className="text-corps">
            <Line label="Dernière mesure">
              <Moment iso={ingestion.last_measure_at} />
            </Line>
            <Line label="Âge de cette mesure">
              {ingestion.measure_age_seconds === null
                ? "inconnu"
                : formatAge(ingestion.measure_age_seconds)}
            </Line>
            <Line label="Écrite en base">
              <Moment iso={ingestion.last_ingested_at} />
            </Line>
            <Line label="Délai d'ingestion">
              {ingestion.ingestion_lag_seconds === null
                ? "—"
                : formatAge(ingestion.ingestion_lag_seconds)}
            </Line>
            <Line label="Seuil de retard">
              {formatAge(ingestion.stale_threshold_seconds)}
            </Line>
          </dl>

          {ingestion.is_stale ? (
            // Un état de la donnée, pas un événement : le lecteur d'écran n'a
            // pas à être interrompu toutes les minutes. Le bandeau d'EV-18
            // porte déjà l'annonce, à l'échelle du parc.
            <p className="mt-3 font-medium text-estimation-800">
              {ingestion.last_measure_at === null
                ? "Ce site n'a aucune mesure : l'ingestion n'a rien écrit."
                : "L'ingestion est en retard sur le seuil de l'API."}
            </p>
          ) : (
            <p className="mt-3 text-ardoise-600">
              L'ingestion est dans les temps annoncés par l'API.
            </p>
          )}

          {ingestion.collector !== null && ingestion.collector !== undefined && (
            <Collector collector={ingestion.collector} />
          )}
        </>
      )}
    </Card>
  );
}
