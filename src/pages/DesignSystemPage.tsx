/**
 * Page de démonstration du design system (EV-47).
 *
 * Servie uniquement en développement — voir `src/routes/AppRoutes.tsx`, qui ne
 * déclare sa route que sous `import.meta.env.DEV`. Elle n'existe pas dans le
 * bundle de production, et n'est donc pas une surface d'attaque.
 *
 * Sa raison d'être : voir les quatre états côte à côte sans avoir à fabriquer
 * une panne. Débrancher l'API pour vérifier qu'un encart d'erreur est lisible
 * est un coût qu'on finit par ne plus payer, et c'est comme ça qu'un état
 * dégradé part en production sans avoir jamais été regardé.
 *
 * Elle n'est pas protégée par l'authentification, à dessein : elle n'affiche
 * aucune donnée réelle, et exiger une session compliquerait son usage sans rien
 * protéger.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import type { ButtonVariant } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { MetricTile } from "../ui/MetricTile";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

/** Une section de la page, titrée et espacée uniformément. */
function Section({
  title,
  rule,
  children,
}: {
  title: string;
  /** La règle du système que la section illustre. */
  rule: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-titre-section font-semibold text-ardoise-900">{title}</h2>
        <p className="mt-1 max-w-3xl text-corps text-ardoise-600">{rule}</p>
      </div>
      {children}
    </section>
  );
}

/** Une nuance de la palette, avec son aplat et son emploi. */
function Swatch({ token, usage }: { token: string; usage: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-10 shrink-0 rounded-controle border border-ardoise-200 ${token}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="truncate font-mono text-annexe text-ardoise-900">{token}</p>
        <p className="text-annexe text-ardoise-600">{usage}</p>
      </div>
    </div>
  );
}

const FAMILIES: { name: string; role: string; swatches: { token: string; usage: string }[] }[] = [
  {
    name: "ardoise",
    role: "Le substrat : textes, bordures, fonds. Tout ce qui n'est pas un signal.",
    swatches: [
      { token: "bg-ardoise-50", usage: "Fond de page, fond de tuile" },
      { token: "bg-ardoise-200", usage: "Bordure de surface" },
      { token: "bg-ardoise-600", usage: "Texte secondaire" },
      { token: "bg-ardoise-900", usage: "Titre, chiffre principal" },
    ],
  },
  {
    name: "mesure",
    role: "La donnée relevée, et l'action principale. Sur une surface de données elle veut dire « mesuré » ; sur une commande, « action principale ».",
    swatches: [
      { token: "bg-mesure-50", usage: "Fond de bandeau d'information" },
      { token: "bg-mesure-200", usage: "Pastille de bandeau" },
      { token: "bg-mesure-700", usage: "Bouton principal, courbe réelle" },
      { token: "bg-mesure-800", usage: "Survol du bouton principal" },
    ],
  },
  {
    name: "estimation",
    role: "Le calculé : prédiction, imputation par l'ETL. Et l'avertissement.",
    swatches: [
      { token: "bg-estimation-50", usage: "Fond du bandeau de démonstration" },
      { token: "bg-estimation-200", usage: "Pastille du bandeau" },
      { token: "bg-estimation-700", usage: "Courbe de prédiction" },
      { token: "bg-estimation-800", usage: "Texte d'avertissement" },
    ],
  },
  {
    name: "alerte",
    role: "L'échec : erreur d'appel, refus, seuil critique franchi.",
    swatches: [
      { token: "bg-alerte-50", usage: "Fond d'encart d'erreur" },
      { token: "bg-alerte-300", usage: "Bordure d'encart" },
      { token: "bg-alerte-700", usage: "Texte d'erreur, bouton danger" },
      { token: "bg-alerte-900", usage: "Texte sur fond d'erreur" },
    ],
  },
];

const TYPE_SCALE: { token: string; usage: string }[] = [
  { token: "text-valeur-xl", usage: "Le chiffre principal d'un panneau" },
  { token: "text-valeur-l", usage: "Les chiffres secondaires" },
  { token: "text-titre-page", usage: "Le nom du produit" },
  { token: "text-titre-section", usage: "Le titre d'une carte" },
  { token: "text-corps", usage: "Le texte courant. La taille par défaut" },
  { token: "text-annexe", usage: "Étiquette en capitales, mention" },
];

const VARIANTS: { variant: ButtonVariant; usage: string }[] = [
  { variant: "principal", usage: "L'action attendue. Un seul par écran." },
  { variant: "secondaire", usage: "Disponible mais non attendue." },
  { variant: "discret", usage: "Tertiaire, dans une barre dense." },
  { variant: "danger", usage: "Destructrice et irréversible." },
];

const SITES = [
  { value: "SITE001", label: "Bureau Paris La Défense — Paris, France" },
  { value: "SITE002", label: "Usine Lyon Vénissieux — Lyon, France" },
];

export function DesignSystemPage() {
  const [texte, setTexte] = useState("");
  const [chargement, setChargement] = useState(false);

  return (
    <div className="min-h-screen bg-ardoise-50">
      <header className="border-b border-ardoise-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="text-annexe font-semibold tracking-wide text-mesure-700 uppercase">
            EnerVision · EV-47 · développement uniquement
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ardoise-900">Design system</h1>
          <p className="mt-2 max-w-3xl text-corps text-ardoise-600">
            Un écran de supervision affiche trois natures de valeur : ce qui a été{" "}
            <strong className="font-semibold text-mesure-700">mesuré</strong>, ce qui a été{" "}
            <strong className="font-semibold text-estimation-800">calculé</strong>, et ce qu'on{" "}
            <strong className="font-semibold text-ardoise-900">ignore</strong>. Le système a une
            obligation : qu'on ne puisse jamais les confondre.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6">
        <Section
          title="Couleur"
          rule="Cinq familles, nommées par leur métier et non par leur teinte. « Primaire 500 » ne dit pas quand s'en servir, « mesure » si. Chaque couple texte / fond du système est au minimum à 4,5:1."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {FAMILIES.map((family) => (
              <Card key={family.name} title={family.name} description={family.role}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {family.swatches.map((swatch) => (
                    <Swatch key={swatch.token} {...swatch} />
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          title="Typographie"
          rule="Pile système, aucune police téléchargée : le produit est déployé on-premise et la CSP fixe font-src 'self'. Tout nombre susceptible de changer porte des chiffres tabulaires, sans quoi un « 1 » plus étroit qu'un « 8 » fait tressauter la ligne à chaque rafraîchissement."
        >
          <Card>
            <dl className="flex flex-col divide-y divide-ardoise-200">
              {TYPE_SCALE.map((step) => (
                <div
                  key={step.token}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <dt className={`font-semibold text-ardoise-900 ${step.token}`}>
                    Consommation 2 654 kW
                  </dt>
                  <dd className="shrink-0 text-annexe text-ardoise-600">
                    <span className="font-mono text-ardoise-900">{step.token}</span> — {step.usage}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </Section>

        <Section
          title="Rayon et élévation"
          rule="Deux rayons, rien au-dessus de 8 px. Une ombre dit « ceci flotte » ; si l'élément ne flotte pas, elle ment. En cas de doute, une bordure suffit."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-controle border border-ardoise-200 bg-white p-4 text-corps">
              <span className="font-mono text-annexe text-ardoise-900">rounded-controle</span>
              <p className="mt-1 text-ardoise-600">6 px — bouton, champ, badge</p>
            </div>
            <div className="rounded-surface border border-ardoise-200 bg-white p-4 text-corps">
              <span className="font-mono text-annexe text-ardoise-900">rounded-surface</span>
              <p className="mt-1 text-ardoise-600">8 px — carte, panneau</p>
            </div>
            <div className="rounded-surface border border-ardoise-200 bg-white p-4 text-corps shadow-flottant">
              <span className="font-mono text-annexe text-ardoise-900">shadow-flottant</span>
              <p className="mt-1 text-ardoise-600">Menu, boîte de dialogue. Rien d'autre.</p>
            </div>
          </div>
        </Section>

        <Section
          title="Bouton"
          rule="Quatre variantes, chacune avec un emploi. En chargement, le bouton conserve sa largeur et remplace son libellé : il ne rétrécit pas sous le curseur."
        >
          <Card>
            <div className="flex flex-col gap-6">
              {VARIANTS.map(({ variant, usage }) => (
                <div key={variant} className="flex flex-col gap-2">
                  <p className="text-annexe text-ardoise-600">
                    <span className="font-mono text-ardoise-900">{variant}</span> — {usage}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant={variant}>Action</Button>
                    <Button variant={variant} size="sm">
                      Petite
                    </Button>
                    <Button variant={variant} disabled>
                      Désactivé
                    </Button>
                    <Button variant={variant} isLoading loadingLabel="En cours…">
                      Action
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-2 border-t border-ardoise-200 pt-4">
                <p className="text-annexe text-ardoise-600">
                  Le chargement en vrai : la largeur ne bouge pas.
                </p>
                <div>
                  <Button
                    isLoading={chargement}
                    loadingLabel="Connexion en cours…"
                    onClick={() => {
                      setChargement(true);
                      setTimeout(() => {
                        setChargement(false);
                      }, 1600);
                    }}
                  >
                    Se connecter
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        <Section
          title="Champs"
          rule="L'étiquette est toujours rendue et toujours liée. Jamais de placeholder en guise d'étiquette : il disparaît à la saisie, exactement quand l'utilisateur en a besoin. L'erreur est portée par aria-invalid, pas seulement par une bordure rouge."
        >
          <Card>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Identifiant"
                value={texte}
                onChange={(event) => {
                  setTexte(event.target.value);
                }}
                hint="Le champ d'aide se rattache par aria-describedby."
              />
              <TextField label="Mot de passe" type="password" required />
              <TextField
                label="Champ en erreur"
                defaultValue="valeur refusée"
                error="Ce champ est obligatoire."
              />
              <TextField label="Champ désactivé" defaultValue="non modifiable" disabled />
              <SelectField label="Site" options={SITES} defaultValue="SITE001" />
              <SelectField
                label="Site (référentiel vide)"
                options={[]}
                placeholder="Aucun site disponible"
                disabled
              />
            </div>
          </Card>
        </Section>

        <Section
          title="Tuile de mesure"
          rule="Une valeur absente s'affiche « — », jamais « 0 ». Zéro est une mesure ; l'absence n'en est pas une. La tuile n'accepte aucune valeur de repli."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Consommation"
              value={2654}
              unit="kW"
              digits={0}
              emphasis="principal"
            />
            <MetricTile label="Tension" value={401.2} unit="V" />
            <MetricTile label="Zéro mesuré" value={0} unit="A" digits={0} />
            <MetricTile label="Absente de la source" value={null} unit="°C" />
          </div>
        </Section>

        <Section
          title="Les quatre états"
          rule="Un état dit toujours de quoi il parle. Un rond qui tourne sans légende, un « Aucune donnée » sec, un bouton grisé sans raison : trois façons de laisser l'utilisateur seul devant un écran qui ne répond pas."
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Chargement">
              <LoadingState>Chargement de la dernière mesure…</LoadingState>
            </Card>
            <Card title="Erreur">
              <ErrorState title="Mesures indisponibles">
                L'API métier est injoignable. Vérifier que le service tourne et que son adresse est
                correcte.
              </ErrorState>
            </Card>
            <Card title="Vide">
              <EmptyState detail="La route est prévue au contrat 1.2.0 et portée par le ticket EV-32.">
                Aucune recommandation n'est disponible : l'API métier n'en publie pas encore.
              </EmptyState>
            </Card>
            <Card title="Désactivé">
              <div className="flex flex-col gap-3">
                <Button disabled>Action indisponible</Button>
                <p className="text-corps text-ardoise-600">
                  La commande grisée, plus la raison quand elle n'est pas évidente à l'écran.
                </p>
              </div>
            </Card>
          </div>
        </Section>

        <Section
          title="Bandeaux"
          rule="Le bandeau se pose au-dessus d'un contenu qui s'affiche quand même — l'état d'erreur, lui, occupe la place d'un contenu absent. Le libellé en capitales porte le sens que la couleur seule ne doit jamais porter."
        >
          <div className="flex flex-col gap-3">
            <Alert tone="information" label="Information">
              La fenêtre affichée couvre les 24 dernières heures.
            </Alert>
            <Alert tone="avertissement" label="Données de démonstration">
              La courbe de prédiction provient d'un JSON figé, pas du service d'inférence.
            </Alert>
            <Alert tone="erreur" label="Service indisponible">
              Le service d'inférence a renvoyé une erreur serveur (502).
            </Alert>
          </div>
        </Section>

        <Section
          title="Ce que le système refuse"
          rule="Un système se définit autant par ce qu'il exclut. Cette liste abrège les discussions."
        >
          <Card>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-2 text-corps text-ardoise-700 md:grid-cols-2">
              {[
                "Le dégradé : il n'encode aucune information.",
                "Le verre dépoli : il dégrade le contraste pour un effet.",
                "Tout rayon supérieur à 8 px : signature d'époque.",
                "L'ombre décorative : elle ment sur ce qui flotte.",
                "Une couleur sans métier.",
                "Les nuances « au cas où ».",
                "L'emoji comme icône : rendu et sens variables.",
                "L'animation sur une donnée : elle suggère un mouvement qui n'a pas eu lieu.",
                "Le placeholder en guise d'étiquette.",
                "Le signalement par la seule couleur.",
                "La valeur écrite en dur.",
                "Le composant écrit avant son deuxième usage.",
              ].map((refus) => (
                <li key={refus} className="flex gap-2">
                  <span aria-hidden className="text-alerte-700">
                    ×
                  </span>
                  <span>{refus}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      </main>
    </div>
  );
}
