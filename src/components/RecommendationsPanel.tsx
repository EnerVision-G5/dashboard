/**
 * Panneau « Recommandations » de la maquette, branché sur l'API (EV-54).
 *
 * Le panneau tenait sa place sans rien afficher depuis EV-48, faute de route au
 * contrat. Le contrat 1.5.0 publie
 * `GET /api/v1/sites/{site_id}/recommendations` et l'API la sert : les conseils
 * affichés ici sont donc **entièrement produits par le service**, à partir des
 * prévisions du modèle. Le dashboard n'en formule aucun, n'en complète aucun,
 * et surtout n'en reclasse aucun : `items` arrive « de la plus urgente à la
 * moins urgente », et cet ordre est respecté tel quel.
 *
 * Trois choix méritent une explication :
 *
 *   - **la sévérité n'est jamais portée par la seule couleur.** Chaque action
 *     affiche son niveau écrit, en capitales, comme les bandeaux du design
 *     system. Un exploitant qui parcourt l'écran doit pouvoir trier sans
 *     distinguer l'ambre du rouge ;
 *   - **une liste vide est expliquée par l'API.** Le contrat sert un champ
 *     `detail` dont la description est explicite : « raison d'une liste vide ».
 *     Le panneau l'affiche plutôt que d'inventer un « rien à signaler » qui
 *     confondrait « aucun risque détecté » et « aucune prévision disponible » ;
 *   - **la version du modèle est affichée avec les conseils.** Le contrat le
 *     dit mieux que ce commentaire ne le ferait : « un conseil ne vaut que ce
 *     que vaut le modèle qui le fonde ».
 */

import type { Recommendation, RecommendationSeverity, RecommendationType } from "../api/recommendations";
import type { Recommendations } from "../api/recommendations";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface RecommendationsPanelProps {
  recommendations: Recommendations | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Habillage de chaque niveau d'urgence : surface et libellé écrit.
 *
 * L'échelle monte du substrat vers l'alerte, en traversant les quatre familles
 * du design system. Employer « mesure » pour le niveau moyen est un écart
 * assumé : cette famille désigne ailleurs la donnée relevée. Il ne crée pas
 * l'ambiguïté que le système veut éviter, parce qu'aucune valeur mesurée n'est
 * affichée dans ces cartes et que le niveau est écrit en clair — mais il valait
 * mieux le dire que le laisser découvrir.
 */
const SEVERITIES: Record<RecommendationSeverity, { surface: string; badge: string; label: string }> =
  {
    low: {
      surface: "border-ardoise-200 bg-white",
      badge: "bg-ardoise-100 text-ardoise-700",
      label: "faible",
    },
    medium: {
      surface: "border-mesure-200 bg-mesure-50",
      badge: "bg-mesure-200 text-mesure-900",
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

/** Natures d'action énumérées par le contrat, en français. */
const TYPES: Record<RecommendationType, string> = {
  predicted_peak: "pointe prévue",
  capacity_overrun: "dépassement de puissance souscrite",
  sensor_failure: "panne de capteur",
};

function heure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR");
}

/** Grandeur en kilowatts, formatée comme le reste de l'interface. */
function kilowatts(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kW`;
}

/**
 * Précisions attachées à une action : la grandeur en jeu, et le moment visé.
 *
 * Le contrat distingue un instant (`at`, pour un délestage par exemple) d'une
 * plage (`window_start` / `window_end`). Les deux ne sont pas interchangeables,
 * et aucun des trois champs n'est garanti : on n'affiche que ce qui est servi.
 */
function Details({ item }: { item: Recommendation }) {
  const précisions: string[] = [];

  if (item.value_kw !== null && item.value_kw !== undefined) {
    précisions.push(kilowatts(item.value_kw));
  }
  if (item.at !== null && item.at !== undefined) {
    précisions.push(`à ${heure(item.at)}`);
  } else if (
    item.window_start !== null &&
    item.window_start !== undefined &&
    item.window_end !== null &&
    item.window_end !== undefined
  ) {
    précisions.push(`de ${heure(item.window_start)} à ${heure(item.window_end)}`);
  }

  if (précisions.length === 0) {
    return null;
  }
  return (
    <p data-valeur className="mt-1 text-corps text-ardoise-700">
      {précisions.join(" · ")}
    </p>
  );
}

function Item({ item }: { item: Recommendation }) {
  const { surface, badge, label } = SEVERITIES[item.severity];

  return (
    <li className={`rounded-controle border px-3 py-2 ${surface}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-controle px-2 py-0.5 text-annexe font-semibold tracking-wide uppercase ${badge}`}
        >
          {label}
        </span>
        <span className="text-annexe tracking-wide text-ardoise-600 uppercase">
          {TYPES[item.type]}
        </span>
      </div>
      {/* Le message vient de l'API, décrit au contrat comme une formulation
          prête à afficher : il n'est ni reformulé, ni tronqué. */}
      <p className="mt-1 text-corps text-ardoise-900">{item.message}</p>
      <Details item={item} />
    </li>
  );
}

/** Provenance des conseils affichés : modèle, horizon, heure du calcul. */
function Provenance({ recommendations }: { recommendations: Recommendations }) {
  return (
    <p className="mt-3 text-annexe text-ardoise-500">
      Sur {recommendations.horizon_hours} h de prévision
      {recommendations.model_version !== null && recommendations.model_version !== undefined
        ? ` · modèle ${recommendations.model_version}`
        : " · aucune version de modèle servie"}
      {" · calculé à "}
      <time dateTime={recommendations.generated_at}>
        {new Date(recommendations.generated_at).toLocaleTimeString("fr-FR")}
      </time>
    </p>
  );
}

export function RecommendationsPanel({
  recommendations,
  isLoading,
  error,
}: RecommendationsPanelProps) {
  return (
    <Card title="Recommandations">
      {isLoading && <LoadingState>Calcul des recommandations du site…</LoadingState>}

      {!isLoading && error !== null && (
        <ErrorState title="Recommandations indisponibles">{error}</ErrorState>
      )}

      {!isLoading && error === null && recommendations === null && (
        <EmptyState>Aucune recommandation pour ce site.</EmptyState>
      )}

      {!isLoading && error === null && recommendations !== null && (
        <>
          {recommendations.items.length === 0 ? (
            <EmptyState
              detail={
                // L'API dit pourquoi la liste est vide. « Aucun risque
                // détecté » et « aucune prévision à examiner » ne se valent
                // pas, et seul le service sait lequel des deux s'applique.
                recommendations.detail ?? undefined
              }
            >
              Aucune action à proposer sur les {recommendations.horizon_hours} prochaines
              heures.
            </EmptyState>
          ) : (
            // L'ordre est celui de l'API, de la plus urgente à la moins
            // urgente : la liste n'est pas retriée ici.
            <ul className="flex flex-col gap-2">
              {recommendations.items.map((item, index) => (
                <Item key={`${item.type}-${item.at ?? item.window_start ?? index}`} item={item} />
              ))}
            </ul>
          )}
          <Provenance recommendations={recommendations} />
        </>
      )}
    </Card>
  );
}
