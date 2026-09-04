/**
 * Page de configuration, coquille servie par EV-50.
 *
 * La navigation principale a besoin d'une seconde destination réelle : un lien
 * qui retomberait sur la règle « * » ramènerait au dashboard sans rien dire,
 * et se lirait comme une panne.
 *
 * Aucun paramètre n'est affiché, et surtout aucun n'est inventé. Le contrat
 * gelé 1.1.0 ne publie aucune route de configuration : un formulaire posé ici
 * aujourd'hui laisserait croire à une persistance qui n'existe pas. Le
 * périmètre fonctionnel est celui d'EV-55, qui devra d'abord trancher où ces
 * paramètres sont censés vivre.
 */

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/states";

export function ConfigPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <Card
        title="Configuration"
        description="Paramètres fonctionnels du client pilote"
      >
        <EmptyState detail="Périmètre d'EV-55 : les paramètres à exposer restent à arbitrer, le contrat de l'API ne publiant aujourd'hui aucune route de configuration.">
          Aucun paramètre n'est encore modifiable depuis cet écran.
        </EmptyState>
      </Card>
    </main>
  );
}
