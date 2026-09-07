/**
 * Bandeau de fraîcheur et de qualité des données (EV-18).
 *
 * Le bandeau est affiché **en permanence**, pas seulement en cas d'incident.
 * Un bandeau qui n'apparaît qu'en cas de problème est indiscernable d'un
 * bandeau en panne : rien à l'écran ne dit alors si les données sont saines ou
 * si la vérification a échoué. L'état sain est donc affiché, discrètement, et
 * porte l'heure du dernier calcul servi par l'API.
 *
 * Trois niveaux, dans le vocabulaire du contrat, et trois traitements :
 *   - `ok` : une ligne sobre sur le substrat, aucun signal ;
 *   - `degraded` : la famille « estimation », celle du calculé et de
 *     l'avertissement, avec le détail des constats ;
 *   - `critical` : la famille « alerte », et un `role="alert"` — un site qui
 *     ne mesure plus rien interrompt la lecture, il ne se glisse pas dans la
 *     page.
 *
 * La couleur ne porte jamais seule le sens : chaque niveau a son titre écrit,
 * et le détail est une liste de phrases complètes.
 */

import type { DataHealth, HealthFinding, HealthLevel } from "../lib/dataHealth";
import { Disclosure } from "../ui/Disclosure";
import { ScrollArea } from "../ui/ScrollArea";

interface DataQualityBannerProps {
  health: DataHealth | null;
  isLoading: boolean;
  /** Erreur de la lecture des indicateurs du parc. */
  indicatorsError: string | null;
  /** Erreur de la lecture des capteurs du site affiché. */
  sensorsError: string | null;
}

/**
 * Habillage de chaque niveau : surface, titre, et rôle d'accessibilité.
 *
 * L'état sain ne porte aucun rôle vivant : il n'a rien à annoncer, et la
 * région nommée suffit à qui vient le consulter. Seuls les deux états qui
 * demandent une réaction s'annoncent — poliment pour `degraded`, en
 * interrompant pour `critical`.
 */
const LEVELS: Record<
  HealthLevel,
  { surface: string; title: string; role?: "status" | "alert" }
> = {
  ok: {
    surface: "border-ardoise-200 bg-white text-ardoise-700",
    title: "Données à jour",
  },
  degraded: {
    surface: "border-estimation-200 bg-estimation-50 text-estimation-900",
    title: "Données incomplètes",
    role: "status",
  },
  critical: {
    surface: "border-alerte-300 bg-alerte-50 text-alerte-900",
    title: "Données inexploitables sur au moins un site",
    role: "alert",
  },
};

/**
 * Nombre de constats affichés d'emblée.
 *
 * Sur sept sites, trois constats par site font vingt et un messages : le
 * bandeau occupait alors la moitié de l'écran et repoussait hors de vue les
 * panneaux qu'il est censé qualifier. Les plus graves restent visibles — ils
 * sont peu nombreux et c'est pour eux qu'on lit le bandeau — le reste est
 * replié derrière un compte.
 */
const APERCU = 3;

/** Une ligne de constat. */
function Finding({ finding }: { finding: HealthFinding }) {
  return <li>{finding.message}</li>;
}

/** Heure du dernier calcul, telle que l'API la sert. */
function CheckedAt({ generatedAt }: { generatedAt: string | null }) {
  if (generatedAt === null) {
    return null;
  }
  return (
    <>
      {" · vérifié à "}
      <time dateTime={generatedAt}>
        {new Date(generatedAt).toLocaleTimeString("fr-FR")}
      </time>
    </>
  );
}

export function DataQualityBanner({
  health,
  isLoading,
  indicatorsError,
  sensorsError,
}: DataQualityBannerProps) {
  if (isLoading) {
    // `aria-busy` sur la région nommée, plutôt qu'un `role="status"` de plus :
    // l'écran en porte déjà un pendant le chargement du graphique, et deux
    // régions vivantes qui s'annoncent en même temps se parlent par-dessus.
    return (
      <section
        aria-label="Fraîcheur et qualité des données"
        aria-busy
        className="rounded-surface border border-ardoise-200 bg-white px-4 py-3 text-corps text-ardoise-600"
      >
        Vérification de la fraîcheur et de la qualité des données…
      </section>
    );
  }

  // Les deux flux sont tombés : le bandeau ne sait rien, et le dit. Il ne
  // prétend surtout pas que tout va bien.
  if (health === null || (indicatorsError !== null && sensorsError !== null)) {
    return (
      <div
        role="alert"
        className="rounded-surface border border-alerte-300 bg-alerte-50 px-4 py-3 text-corps text-alerte-900"
      >
        <p className="font-medium">Fraîcheur des données inconnue</p>
        <p className="mt-0.5">
          {indicatorsError ?? sensorsError ?? "L'API métier n'a rien renvoyé."} Les
          données affichées ne peuvent pas être qualifiées.
        </p>
      </div>
    );
  }

  const { surface, title, role } = LEVELS[health.level];

  return (
    <section
      aria-label="Fraîcheur et qualité des données"
      className={`rounded-surface border px-4 py-3 ${surface}`}
    >
      <p role={role} className="text-corps font-medium">
        {title}
        <span className="font-normal">
          {" · "}
          {health.sitesChecked} site(s) examiné(s)
          <CheckedAt generatedAt={health.generatedAt} />
        </span>
      </p>

      {health.findings.length > 0 && (
        <div className="mt-2 flex flex-col gap-2 text-corps">
          {/* Les constats les plus graves sont déjà en tête de liste : les
              trois premiers sont donc ceux qu'il faut lire. */}
          <ul className="flex flex-col gap-1">
            {health.findings.slice(0, APERCU).map((finding) => (
              <Finding
                key={`${finding.siteId}-${finding.kind}-${finding.message}`}
                finding={finding}
              />
            ))}
          </ul>

          {health.findings.length > APERCU && (
            <Disclosure
              summary={`${health.findings.length - APERCU} autre(s) constat(s) sur ${health.sitesChecked} site(s)`}
            >
              <ScrollArea
                label="Détail des constats de qualité"
                height="courte"
              >
                <ul className="flex flex-col gap-1 pr-2">
                  {health.findings.slice(APERCU).map((finding) => (
                    <Finding
                      key={`${finding.siteId}-${finding.kind}-${finding.message}`}
                      finding={finding}
                    />
                  ))}
                </ul>
              </ScrollArea>
            </Disclosure>
          )}
        </div>
      )}

      {/* Un seul flux en échec : ce qui a été lu reste affiché, et ce qui
          manque est nommé. Taire la moitié manquante donnerait un bandeau
          rassurant à tort. */}
      {indicatorsError !== null && (
        <p className="mt-2 text-corps">
          Fraîcheur et qualité du parc indisponibles : {indicatorsError}
        </p>
      )}
      {sensorsError !== null && (
        <p className="mt-2 text-corps">
          État des capteurs du site indisponible : {sensorsError}
        </p>
      )}
    </section>
  );
}
