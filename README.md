# dashboard

[![ci](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml)

Dashboard web EnerVision (React + Recharts, ADR-008) : consommations, prédictions
et alertes. Il parle uniquement à l'`api` (REST + JWT).

La CI (`.github/workflows/ci.yml`) enchaîne lint (eslint), tests et build à
chaque push et sur chaque pull request. Un lint cassé fait échouer la PR.

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Types dérivés des contrats OpenAPI

Les types de `src/types` sont générés à partir des contrats OpenAPI gelés du
repo `enervision`, dans `docs/contracts`.

**Ne jamais éditer `src/types` à la main, toujours regénérer via
`npm run gen:types` après une évolution de contrat.**

```bash
npm run gen:types
```

- `openapi-api.json` produit `src/types/api.d.ts` (sites, mesures, alertes, auth).
- `openapi-predict.json` produit `src/types/predict.d.ts` (prédictions).

Le script résout le dossier des contrats à `../docs/contracts`, ce qui
correspond à la position du dashboard monté en submodule dans `enervision`. Si
le dashboard est cloné isolément, pointer la variable d'environnement
`CONTRACTS_DIR` sur le dossier `docs/contracts` d'une copie du repo
`enervision` :

```bash
CONTRACTS_DIR=/chemin/vers/enervision/docs/contracts npm run gen:types
```

Une évolution de contrat passe d'abord par une PR sur `enervision`, décrite
dans `docs/contracts/README.md` de ce repo. Les types sont régénérés et
committés une fois cette PR fusionnée.
