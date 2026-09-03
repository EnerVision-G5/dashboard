# dashboard

[![ci](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml)

Dashboard web EnerVision (React + Vite + Recharts, ADR-008).

L'écran livré par **EV-16** permet à un client pilote de choisir un site et de
lire, sur un même graphique, sa **consommation réelle** des 24 dernières heures
et sa **prédiction** sur les 24 heures suivantes.

Le dashboard ne parle qu'à des services EnerVision : l'API métier pour les
sites et les mesures, le service d'inférence pour la prédiction. **Il n'appelle
jamais l'API Mock IoT directement.**

## Prérequis

- **Node 24** (version utilisée par la CI ; `jsdom` exige au minimum Node 22.22
  ou 24.15).
- Une API métier joignable, et un service d'inférence joignable si l'on veut la
  prédiction réelle.

## Installation et commandes

```bash
npm ci
```

| Commande            | Rôle                                               |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Serveur de développement sur http://localhost:5173 |
| `npm test`          | Tests Vitest + Testing Library (une seule passe)   |
| `npm run lint`      | ESLint                                             |
| `npm run build`     | Vérification TypeScript puis build de production   |
| `npm run gen:types` | Régénère `src/types` depuis les contrats OpenAPI   |

La CI (`.github/workflows/ci.yml`) enchaîne `npm ci`, `npm run lint`,
`npm test` et `npm run build` à chaque push et sur chaque pull request. Le job
de tests appelle `npm test` sans `--if-present` : une suite absente fait
désormais échouer la CI au lieu de la laisser verte à tort.

## Configuration

Copier `.env.example` en `.env` (ou `.env.local`, ignoré par git) et adapter.

| Variable                        | Rôle                                                     | Défaut      |
| ------------------------------- | -------------------------------------------------------- | ----------- |
| `VITE_API_BASE_URL`             | Base de l'API métier (sites, mesures)                    | **requise** |
| `VITE_PREDICT_BASE_URL`         | Base du service d'inférence                              | **requise** |
| `VITE_PREDICTION_SOURCE`        | `api` (service réel) ou `fixture` (JSON de démonstration) | `api`       |
| `VITE_DEV_PROXY_API_TARGET`     | Cible du proxy de dev pour `/proxy/api` (facultatif)     | —           |
| `VITE_DEV_PROXY_PREDICT_TARGET` | Cible du proxy de dev pour `/proxy/predict` (facultatif) | —           |

Aucune de ces valeurs n'est un secret. Le dashboard n'émet ni jeton ni
identifiant : l'authentification relève d'EV-12, et l'API métier sert les
lectures en anonyme tant que `AUTH_ENABLED=false`.

Une base absente n'est pas remplacée par une valeur devinée : l'écran affiche
une erreur de configuration nommant la variable manquante.

### Deux bases, et après ?

Le contrat gelé publie encore deux spécifications distinctes
(`openapi-api.json` et `openapi-predict.json`), donc deux services. La cible
d'architecture V2 est un dashboard ne parlant qu'à l'API métier, laquelle ferait
proxy vers Predict. Le code est prêt pour ce basculement : seules les fonctions
de `src/config/env.ts` connaissent les bases, les composants ne voient que
`fetchPrediction`. Le jour venu, il suffira de faire pointer
`VITE_PREDICT_BASE_URL` sur l'API métier.

### Proxy de développement et CORS

L'API métier **ne publie aucun en-tête `Access-Control-*`**. Appelée
directement depuis `http://localhost:5173`, sa réponse est bloquée par le
navigateur. Pour une recette locale, faire passer les appels par l'origine de
Vite :

```bash
VITE_API_BASE_URL=/proxy/api
VITE_PREDICT_BASE_URL=/proxy/predict
VITE_DEV_PROXY_API_TARGET=http://localhost:8080
VITE_DEV_PROXY_PREDICT_TARGET=http://localhost:8001
```

Ce proxy ne concerne que `npm run dev`. En production, l'API doit autoriser
l'origine du dashboard, ou le servir derrière le même nom de domaine.

## Flux de données

```
GET  /api/v1/sites               → référentiel, alimente le sélecteur
GET  /api/v1/sites/{id}/readings → mesures des 24 dernières heures
POST /api/v1/predict             → prévision sur 24 heures
                                 ↓
             fusion par horodatage (src/lib/series.ts)
                                 ↓
                  graphique Recharts, deux courbes
```

Au chargement, le premier site dont le `status` vaut `active` est présélectionné
— valeur initiale seulement, jamais réimposée ensuite. Changer de site relance
les deux flux ; la requête précédente est annulée (`AbortController`), et les
données ne sont affichées que si elles proviennent bien du site demandé.

### Pagination des mesures

`GET /readings` plafonne une page à 1 000 éléments. À une mesure par minute,
24 heures en produisent 1 440 : le client suit donc `meta.total` et incrémente
`offset` jusqu'à couvrir la fenêtre. Une page vide interrompt la boucle, et un
plafond de 20 pages la borne si le serveur annonçait un total incohérent.

### Valeurs nulles et valeurs imputées

L'API conserve les valeurs brutes de la source. Le dashboard fait de même :

- `consumption_kw` à `null` reste un **trou** dans la courbe
  (`connectNulls={false}`) ; le nombre de mesures absentes est affiché sous le
  graphique ;
- `consumption_kw_imputed` **n'est jamais tracée comme une mesure réelle**. Elle
  est transportée jusqu'au survol, avec sa méthode (`locf`, `interpolation`), et
  présentée explicitement comme reconstituée par l'ETL ;
- `data_quality` est repris tel quel dans l'infobulle ;
- aucun point n'est fabriqué pour relier la dernière mesure à la première
  prédiction : les deux courbes ne se rejoignent que si le contrat renvoie
  réellement le même horodatage ;
- les bornes de confiance nulles sont ignorées, jamais inventées.

### États d'erreur

Les deux flux échouent indépendamment : une prédiction indisponible n'efface pas
des mesures correctement reçues. Chaque code a un message dédié — 401 (renvoi
vers EV-12), 404, 422, 501, 503 et service injoignable — et le `detail` du
contrat est repris quand il apporte une information utile.

**Aucune erreur ne déclenche le mode démonstration.** En mode `api`, une panne
est affichée comme une panne.

## Mode JSON de démonstration

`POST /api/v1/predict` est implémenté depuis
[predict#26](https://github.com/EnerVision-G5/predict/pull/26), mais répond
**503** tant qu'aucun modèle n'est publié au registre MLflow. Pour démontrer
l'écran malgré cela :

```bash
VITE_PREDICTION_SOURCE=fixture
```

Dans ce mode :

- la prédiction vient de `src/fixtures/prediction-demo.json`, un JSON versionné,
  déterministe et conforme à `PredictionOut` (24 points horaires, valeurs fixes,
  validé par TypeScript via `satisfies`) ;
- **les mesures restent réelles** : seule la courbe de prédiction est simulée ;
- un bandeau **« Données de démonstration »** est affiché en haut de l'écran et
  nomme la série concernée ;
- `model_version` vaut `demo-fixture-1.0.0`, ce qui identifie sans ambiguïté une
  donnée simulée ;
- aucun appel réseau n'est émis vers le service d'inférence.

Seul un décalage en jours entiers est appliqué pour amener la série en face de
la fenêtre affichée, ce qui préserve son profil jour/nuit. Les valeurs, elles,
ne sont jamais modifiées.

**Pour revenir au service réel :** remettre `VITE_PREDICTION_SOURCE=api` (ou
supprimer la ligne) et relancer `npm run dev`. La suppression définitive du mode
se limite à `src/fixtures/`, à `getPredictionSource` dans `src/config/env.ts` et
au composant `DemoDataBadge`.

## Recette manuelle

La procédure détaillée, avec les commandes exactes et ce qui a été vérifié, est
dans [`docs/EV-16-recette.md`](docs/EV-16-recette.md).

## Types dérivés des contrats OpenAPI

Les types de `src/types` sont générés depuis les contrats OpenAPI gelés du repo
`enervision`, dans `docs/contracts`.

**Ne jamais éditer `src/types` à la main, toujours régénérer via
`npm run gen:types` après une évolution de contrat.**

```bash
npm run gen:types
```

- `openapi-api.json` produit `src/types/api.d.ts` (sites, mesures, alertes, auth).
- `openapi-predict.json` produit `src/types/predict.d.ts` (prédictions).

Le script résout le dossier des contrats à `../docs/contracts`, position du
dashboard monté en submodule dans `enervision`. Si le dashboard est cloné
isolément, pointer `CONTRACTS_DIR` sur une copie du repo `enervision` :

```bash
CONTRACTS_DIR=/chemin/vers/enervision/docs/contracts npm run gen:types
```

Une évolution de contrat passe d'abord par une PR sur `enervision`, décrite dans
`docs/contracts/README.md` de ce repo. Les types sont régénérés et committés une
fois cette PR fusionnée.
