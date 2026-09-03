/**
 * Panneau « Recommandations » de la maquette.
 *
 * Le panneau existe, sa place dans la mise en page est tenue, mais il n'a
 * volontairement aucune donnée à afficher : le contrat gelé 1.0.0 ne publie
 * aucune route de recommandations. Celle qui est pressentie,
 * `GET /api/v1/sites/{site_id}/recommendations`, relève du contrat 1.2.0 et
 * du ticket EV-32 ; le guide d'intégration front demande explicitement que le
 * front ne l'anticipe pas dans son code tant que la PR de contrat n'est pas
 * fusionnée.
 *
 * Trois recommandations d'exemple auraient rempli la maquette, mais des
 * conseils inventés sur une facture d'électricité ne sont pas une donnée de
 * démonstration : ils seraient lus comme de vrais conseils. Le panneau dit
 * donc ce qu'il en est.
 */

/** Ticket portant le module de recommandations. */
export const RECOMMENDATIONS_TICKET = "EV-32";

export function RecommendationsPanel() {
  return (
    <section
      aria-labelledby="recommendations-heading"
      className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h2 id="recommendations-heading" className="text-base font-semibold text-slate-900">
        Recommandations
      </h2>
      <p className="mt-4 text-sm text-slate-600">
        Aucune recommandation n'est disponible : l'API métier n'en publie pas encore.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        La route est prévue au contrat 1.2.0 et portée par le ticket{" "}
        {RECOMMENDATIONS_TICKET}. Ce panneau sera branché dessus une fois le contrat
        fusionné.
      </p>
    </section>
  );
}
