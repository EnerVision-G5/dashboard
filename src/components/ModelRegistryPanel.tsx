/**
 * Registre des modèles : version promue, et historique des versions.
 *
 * Le dashboard affiche déjà la version qui a produit une prévision ou fondé une
 * recommandation. Ce panneau répond à la question d'après : *laquelle est
 * promue en ce moment, et depuis quand ?* — c'est ce qu'on vient chercher
 * lorsqu'une dérive apparaît, pour savoir si elle suit une promotion.
 *
 * Deux dates sont servies et ne se confondent pas : `date_entrainement`, quand
 * le modèle a été entraîné, et `created_at`, quand la ligne est entrée au
 * registre. Un modèle entraîné en juin et promu en septembre n'a pas la même
 * histoire qu'un modèle entraîné la veille.
 *
 * **Aucun modèle promu n'est une situation normale**, pas une panne : le
 * registre MLflow peut être vide, et c'est le cas courant tant que rien n'y a
 * été publié. Le 404 de `GET /models/current` est donc traduit en information,
 * pas en erreur.
 */

import type { Model } from "../api/models";
import { Card } from "../ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";

interface ModelRegistryPanelProps {
  current: Model | null;
  models: readonly Model[];
  isLoading: boolean;
  error: string | null;
  currentError: string | null;
}

function jour(iso: string | null | undefined): string {
  return iso === null || iso === undefined
    ? "—"
    : new Date(iso).toLocaleDateString("fr-FR");
}

/** Le modèle promu, détaillé. */
function Current({ model }: { model: Model }) {
  return (
    <div className="rounded-controle border border-mesure-200 bg-mesure-50 px-3 py-2">
      <p className="text-annexe font-medium tracking-wide text-mesure-900 uppercase">
        Modèle promu
      </p>
      <p data-valeur className="mt-0.5 text-valeur-l font-semibold text-ardoise-900">
        {model.nom} · {model.version}
      </p>
      <dl className="mt-1 text-corps text-ardoise-700">
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt>Entraîné le</dt>
          <dd data-valeur>{jour(model.date_entrainement)}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt>Entré au registre le</dt>
          <dd data-valeur>{jour(model.created_at)}</dd>
        </div>
        {model.mlflow_run_id !== null && model.mlflow_run_id !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt>Run MLflow</dt>
            {/* Tronqué à l'affichage : un identifiant de run fait 32 caractères
                et déborderait la carte. Le titre porte la valeur entière, pour
                qu'elle reste copiable et lisible au survol. */}
            <dd data-valeur className="font-mono text-annexe" title={model.mlflow_run_id}>
              {model.mlflow_run_id.slice(0, 12)}…
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function ModelRegistryPanel({
  current,
  models,
  isLoading,
  error,
  currentError,
}: ModelRegistryPanelProps) {
  // Les versions déjà décrites en tête ne sont pas répétées dans la liste.
  const others = models.filter((model) => model.modele_id !== current?.modele_id);

  return (
    <Card title="Modèles">
      {isLoading && <LoadingState>Lecture du registre des modèles…</LoadingState>}

      {!isLoading && (
        <div className="flex flex-col gap-3">
          {currentError !== null && (
            <ErrorState title="Modèle promu indisponible">{currentError}</ErrorState>
          )}

          {currentError === null && current !== null && <Current model={current} />}

          {currentError === null && current === null && (
            <EmptyState detail="Le service d'inférence répond 503 tant qu'aucun modèle n'est publié au registre MLflow ; les prévisions sont alors indisponibles.">
              Aucun modèle n'est promu actuellement.
            </EmptyState>
          )}

          {error !== null && (
            <ErrorState title="Registre des modèles indisponible">{error}</ErrorState>
          )}

          {error === null && others.length > 0 && (
            <div>
              <h3 className="text-annexe font-medium tracking-wide text-ardoise-600 uppercase">
                Versions précédentes
              </h3>
              <ul className="mt-1 text-corps">
                {others.map((model) => (
                  <li
                    key={model.modele_id}
                    className="flex flex-wrap justify-between gap-x-4 border-b border-ardoise-100 py-1.5 last:border-b-0"
                  >
                    <span className="text-ardoise-900">
                      {model.nom} · {model.version}
                    </span>
                    <span data-valeur className="text-ardoise-600">
                      entraîné le {jour(model.date_entrainement)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error === null && others.length === 0 && current !== null && (
            <p className="text-corps text-ardoise-600">
              Aucune version antérieure au registre.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
