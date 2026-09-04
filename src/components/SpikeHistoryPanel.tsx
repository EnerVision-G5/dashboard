/**
 * Historique des pics de charge simulés sur le site affiché.
 *
 * Un pic simulé n'est pas un incident subi : c'est un ordre qu'on a passé, et
 * l'historique répond à « qu'a-t-on déclenché, quand, et qu'est-ce que la
 * source en a fait ». D'où trois informations affichées ensemble : l'auteur, le
 * statut renvoyé par la source, et la consommation réellement constatée.
 *
 * `consumption_kw_constatee` et `data_quality_constatee` peuvent être nuls :
 * la source a accepté l'ordre sans renvoyer de relevé. Ce n'est pas un échec,
 * et ce n'est pas zéro kW non plus — l'absence est affichée comme telle.
 */

import type { SpikeSimulation } from "../api/simulations";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface SpikeHistoryPanelProps {
  spikes: readonly SpikeSimulation[];
  isLoading: boolean;
  error: string | null;
}

function moment(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

function Spike({ spike }: { spike: SpikeSimulation }) {
  const constatee =
    spike.consumption_kw_constatee === null || spike.consumption_kw_constatee === undefined
      ? null
      : `${spike.consumption_kw_constatee.toLocaleString("fr-FR", {
          maximumFractionDigits: 0,
        })} kW`;

  return (
    <li className="border-b border-ardoise-100 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="font-medium text-ardoise-900">
          {spike.duration_minutes} min · {spike.evenement}
        </p>
        <p data-valeur className="text-corps text-ardoise-600">
          <time dateTime={spike.declenche_le}>{moment(spike.declenche_le)}</time>
        </p>
      </div>
      <p className="text-corps text-ardoise-600">
        Statut de la source : {spike.statut}
        {spike.declenche_par !== null && spike.declenche_par !== undefined
          ? ` · demandé par ${spike.declenche_par}`
          : ""}
      </p>
      <p className="text-corps text-ardoise-600">
        {constatee === null
          ? "Aucun relevé renvoyé par la source au déclenchement."
          : `Consommation constatée : ${constatee}`}
        {spike.data_quality_constatee !== null &&
          spike.data_quality_constatee !== undefined &&
          ` · qualité ${spike.data_quality_constatee}`}
      </p>
      {spike.message !== null && spike.message !== undefined && (
        <p className="text-corps text-ardoise-500">{spike.message}</p>
      )}
    </li>
  );
}

export function SpikeHistoryPanel({ spikes, isLoading, error }: SpikeHistoryPanelProps) {
  return (
    <Card title="Historique des pics de charge">
      {isLoading && <LoadingState>Lecture des pics simulés…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="Historique des pics indisponible">{error}</ErrorState>
      )}

      {!isLoading && error === null && spikes.length === 0 && (
        <EmptyState detail="Un pic n'apparaît ici que s'il a été déclenché depuis le dashboard ou l'API.">
          Aucun pic simulé sur ce site.
        </EmptyState>
      )}

      {!isLoading && error === null && spikes.length > 0 && (
        <ul className="text-corps">
          {spikes.map((spike) => (
            <Spike key={spike.simulation_id} spike={spike} />
          ))}
        </ul>
      )}
    </Card>
  );
}
