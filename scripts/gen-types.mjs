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
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractsDir = resolve(
  projectRoot,
  process.env.CONTRACTS_DIR ?? "../docs/contracts",
);

const targets = [
  { contract: "openapi-api.json", output: "src/types/api.d.ts" },
  { contract: "openapi-predict.json", output: "src/types/predict.d.ts" },
];

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

for (const { contract, output } of targets) {
  const source = resolve(contractsDir, contract);
  console.log(`${contract} -> ${output}`);
  execFileSync(
    "npx",
    ["--no-install", "openapi-typescript", source, "-o", resolve(projectRoot, output)],
    { cwd: projectRoot, stdio: "inherit", shell: process.platform === "win32" },
  );
}
