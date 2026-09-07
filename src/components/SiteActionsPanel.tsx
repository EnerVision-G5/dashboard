/**
 * Actions d'exploitation sur le site affiché : déclencher un pic, resynchroniser
 * le référentiel.
 *
 * Ce sont les deux seules commandes du dashboard, et les deux seules qui
 * **écrivent**. Tout le reste de l'application lit. Trois conséquences :
 *
 *   - le rôle est vérifié avant d'afficher les boutons. Le contrat réserve les
 *     deux routes au rôle `writer` (403 sinon), et le rôle est lu dans le
 *     jeton. Proposer une commande qu'on sait refusée serait une fausse
 *     promesse — la garde reste un confort d'affichage, l'API restant seule
 *     autorité ;
 *   - le pic **n'est pas une simulation d'écran**. L'API relaie l'ordre à la
 *     source, qui produit une vraie surconsommation dans les mesures
 *     suivantes. Le libellé le dit, et le résultat rappelle que le pic
 *     n'apparaîtra qu'au relevé suivant ;
 *   - un échec est nommé pour ce qu'il est. Un 403 n'est pas un 502 : le
 *     premier dit que le compte n'a pas le droit, le second que la source n'a
 *     pas répondu. `toApiError` produit déjà ces deux messages, ils sont
 *     affichés tels quels.
 */

import { useState } from "react";
import type { SiteSync } from "../api/sites";
import type { SpikeSimulation } from "../api/simulations";
import { getApiClient } from "../api/clients";
import { syncSites } from "../api/sites";
import { SPIKE_DURATION_MINUTES, triggerSpike } from "../api/simulations";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState } from "../ui/states";

interface SiteActionsPanelProps {
  /** Site sur lequel le pic sera déclenché. */
  siteId: string | null;
  /** Nom du site, pour que le résultat nomme ce qui a été fait. */
  siteName: string | null;
  /** Appelé après un pic accepté, pour relire l'historique. */
  onSpikeTriggered?: () => void;
  /** Appelé après une synchronisation, pour relire le référentiel. */
  onSitesSynced?: () => void;
}

/** Ce que la dernière commande a produit. */
interface Outcome {
  kind: "spike" | "sync";
  message: string;
}

function describeSpike(spike: SpikeSimulation, siteName: string | null): string {
  const cible = siteName ?? spike.site_id;
  const constatee =
    spike.consumption_kw_constatee === null || spike.consumption_kw_constatee === undefined
      ? null
      : `${spike.consumption_kw_constatee.toLocaleString("fr-FR", {
          maximumFractionDigits: 0,
        })} kW relevés`;

  return [
    `Pic de ${spike.duration_minutes} min demandé sur ${cible} : ${spike.statut}`,
    constatee,
    "il apparaîtra dans la courbe au relevé suivant",
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function describeSync(sync: SiteSync): string {
  const ignores = sync.received - sync.synchronized;
  const base = `${sync.synchronized} site(s) synchronisé(s) sur ${sync.received} annoncé(s) par la source`;
  // L'écart n'est pas anodin : l'API refuse un site auquel manque un champ
  // obligatoire du contrat. Le taire donnerait un référentiel silencieusement
  // incomplet.
  return ignores > 0
    ? `${base} · ${ignores} écarté(s), champs obligatoires manquants`
    : base;
}

export function SiteActionsPanel({
  siteId,
  siteName,
  onSpikeTriggered,
  onSitesSynced,
}: SiteActionsPanelProps) {
  const { session } = useAuth();
  const [pending, setPending] = useState<"spike" | "sync" | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isWriter = session?.claims.role === "writer";

  async function run(kind: "spike" | "sync"): Promise<void> {
    setPending(kind);
    setError(null);
    setOutcome(null);
    try {
      if (kind === "spike") {
        if (siteId === null) {
          return;
        }
        const spike = await triggerSpike({ client: getApiClient(), siteId });
        setOutcome({ kind, message: describeSpike(spike, siteName) });
        onSpikeTriggered?.();
      } else {
        const sync = await syncSites(getApiClient());
        setOutcome({ kind, message: describeSync(sync) });
        onSitesSynced?.();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setPending(null);
    }
  }

  if (!isWriter) {
    return (
      <Card title="Actions d'exploitation">
        <EmptyState detail="Le contrat réserve le déclenchement d'un pic et la synchronisation du référentiel au rôle writer.">
          {session === null
            ? "Aucune session ouverte."
            : `Le rôle ${session.claims.role ?? "inconnu"} ne permet pas d'agir sur la source.`}
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card
      title="Actions d'exploitation"
      description="Ces deux commandes écrivent : elles agissent sur la source, pas sur l'affichage."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void run("spike")}
          isLoading={pending === "spike"}
          loadingLabel="Déclenchement…"
          disabled={siteId === null || pending !== null}
        >
          Déclencher un pic de {SPIKE_DURATION_MINUTES} min
        </Button>
        <Button
          variant="secondaire"
          onClick={() => void run("sync")}
          isLoading={pending === "sync"}
          loadingLabel="Synchronisation…"
          disabled={pending !== null}
        >
          Recharger les sites
        </Button>
      </div>

      {error !== null && (
        <div className="mt-3">
          <ErrorState title="Commande refusée">{error}</ErrorState>
        </div>
      )}

      {outcome !== null && (
        // `role="status"` : le résultat d'une commande que l'utilisateur vient
        // de lancer doit être annoncé, contrairement à une valeur qui se
        // rafraîchit toute seule.
        <p role="status" className="mt-3 text-corps text-ardoise-700">
          {outcome.message}
        </p>
      )}
    </Card>
  );
}
