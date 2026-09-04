/**
 * Panneau « Recommandations » de la maquette.
 *
 * Le panneau existe, sa place dans la mise en page est tenue, mais il n'a
 * volontairement aucune donnée à afficher : le contrat gelé ne publie aucune
 * route de recommandations. Celle qui est pressentie,
 * `GET /api/v1/sites/{site_id}/recommendations`, relève du contrat 1.2.0 et du
 * ticket EV-32 ; le guide d'intégration front demande explicitement que le
 * front ne l'anticipe pas dans son code tant que la PR de contrat n'est pas
 * fusionnée.
 *
 * Trois recommandations d'exemple auraient rempli la maquette, mais des
 * conseils inventés sur une facture d'électricité ne sont pas une donnée de
 * démonstration : ils seraient lus comme de vrais conseils.
 */

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/states";

/** Ticket portant le module de recommandations. */
export const RECOMMENDATIONS_TICKET = "EV-32";

export function RecommendationsPanel() {
  return (
    <Card title="Recommandations">
      <EmptyState
        detail={`La route est prévue au contrat 1.2.0 et portée par le ticket ${RECOMMENDATIONS_TICKET}. Ce panneau sera branché dessus une fois le contrat fusionné.`}
      >
        Aucune recommandation n'est disponible : l'API métier n'en publie pas encore.
      </EmptyState>
    </Card>
  );
}
