// Génère les types TypeScript du dashboard à partir des contrats OpenAPI gelés.
//
// Les fichiers produits dans src/types ne sont jamais édités à la main : ils
// sont la projection du contrat figé dans le repo enervision.
//
// Le dossier des contrats est résolu dans cet ordre :
//   1. la variable d'environnement CONTRACTS_DIR, si elle est définie,
//   2. ../docs/contracts, position du dossier quand le dashboard est monté en
//      submodule dans enervision.
// La variable existe pour le cas où le dashboard est cloné isolément.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = resolve(
  projectRoot,
  process.env.CONTRACTS_DIR ?? "../docs/contracts",
);

// Une seule cible : le dashboard ne parle qu'à l'API métier. Les prédictions
// sont lues sur sa route de lecture, plus sur le service d'inférence, dont le
// contrat reste la référence entre api et predict mais ne concerne plus le
// front.
const targets = [{ contract: "openapi-api.json", output: "src/types/api.d.ts" }];

const missing = targets
  .map(({ contract }) => resolve(contractsDir, contract))
  .filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error(
    [
      `Contrats introuvables dans ${contractsDir} :`,
      ...missing.map((path) => `  ${path}`),
      "",
      "Vérifier que le submodule enervision est initialisé, ou définir",
      "CONTRACTS_DIR sur le dossier docs/contracts du repo enervision.",
    ].join("\n"),
  );
  process.exit(1);
}

mkdirSync(resolve(projectRoot, "src/types"), { recursive: true });

// Le générateur est appelé par son fichier, exécuté par le Node courant, et
// non par « npx » dans un shell. Sur Windows, npx n'est atteignable que via un
// shell, et un shell ne reçoit pas les arguments échappés : un chemin de projet
// contenant une espace y était coupé au premier blanc, si bien que les types
// atterrissaient dans un fichier portant la première moitié du chemin — sans
// aucune erreur, le fichier attendu restant inchangé.
const require = createRequire(import.meta.url);
const generator = resolve(
  dirname(require.resolve("openapi-typescript/package.json")),
  "bin/cli.js",
);

for (const { contract, output } of targets) {
  const source = resolve(contractsDir, contract);
  console.log(`${contract} -> ${output}`);
  execFileSync(
    process.execPath,
    [generator, source, "-o", resolve(projectRoot, output)],
    { cwd: projectRoot, stdio: "inherit" },
  );
}
