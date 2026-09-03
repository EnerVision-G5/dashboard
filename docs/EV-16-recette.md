# EV-16 — Recette

Procédure de recette de l'écran « consommation et prédiction par site », et
relevé de ce qui a réellement été vérifié.

## 1. Démarrer les services

### API métier (sites et mesures)

```bash
git clone --branch develop https://github.com/EnerVision-G5/api.git
cd api && cp .env.example .env
docker compose -f compose.dev.yml up -d --build
```

L'API écoute sur `http://localhost:8080`. `AUTH_ENABLED=false` par défaut : les
lectures sont servies en anonyme, le dashboard n'a donc aucun jeton à produire.

Le schéma de la base appartient au repo infra. Sans lui, `GET /api/v1/sites`
répond 500. En recette locale, la chaîne complète est
`collector → TimescaleDB → ETL` ; à défaut, reconstruire les tables depuis les
modèles ORM de l'API (comme le font ses tests d'intégration) et y insérer un
jeu de mesures.

### Service d'inférence (prédiction)

```bash
git clone --branch develop https://github.com/EnerVision-G5/predict.git
cd predict && cp .env.example .env
docker compose up -d mlflow serving
```

Le service écoute sur le port `8000` du conteneur. Il démarre même sans registre
joignable et refuse alors les prévisions en **503** : la prédiction réelle exige
un modèle publié dans MLflow, ce qui relève d'EV-20 et suivants.

### Dashboard

```bash
cp .env.example .env.local
```

L'API métier ne publiant aucun en-tête `Access-Control-*`, passer par le proxy
de développement :

```bash
VITE_API_BASE_URL=/proxy/api
VITE_PREDICT_BASE_URL=/proxy/predict
VITE_DEV_PROXY_API_TARGET=http://localhost:8080
VITE_DEV_PROXY_PREDICT_TARGET=http://localhost:8001
VITE_PREDICTION_SOURCE=api
```

```bash
npm ci
npm run dev
```

## 2. Points à contrôler

| # | Contrôle | Attendu |
|---|----------|---------|
| 1 | Ouvrir http://localhost:5173 | Le sélecteur liste les sites de `GET /api/v1/sites` |
| 2 | Sélection initiale | Premier site `status = active` |
| 3 | Courbe réelle | Trait plein, unité kW, axe temporel lisible |
| 4 | Pagination | Onglet réseau : `offset=0` puis `offset=1000` sur `/readings` |
| 5 | Mesures absentes | Trou visible dans la courbe, compteur sous le graphique |
| 6 | Survol d'un trou | Qualité de la mesure et valeur imputée annoncée comme reconstituée |
| 7 | Changement de site | Les deux flux sont relancés, aucune donnée du site précédent ne subsiste |
| 8 | Prédiction indisponible | Message d'erreur explicite, **aucune** donnée inventée |
| 9 | Clavier | Le sélecteur est atteignable au `Tab` et pilotable aux flèches |
| 10 | Mobile | Écran lisible en 375 px de large |

Puis, mode démonstration :

```bash
VITE_PREDICTION_SOURCE=fixture   # relancer npm run dev
```

| #  | Contrôle | Attendu |
|----|----------|---------|
| 11 | Bandeau | « Données de démonstration », nommant la série simulée |
| 12 | Réseau | Aucun `POST /api/v1/predict` |
| 13 | Modèle affiché | `demo-fixture-1.0.0` |
| 14 | Mesures | Toujours réelles, issues de l'API métier |
| 15 | Retour arrière | `VITE_PREDICTION_SOURCE=api` fait réapparaître l'erreur réelle, pas le JSON |

## 3. Relevé de la recette du 2 septembre 2026

### Ce qui a été vérifié contre les vrais services

**API métier** — `EnerVision-G5/api@develop` (EV-11 fusionnée, PR #16), lancée
via `compose.dev.yml`, schéma reconstruit depuis les modèles ORM et alimenté de
3 sites et 2 880 mesures à la minute sur 24 h, dont une coupure capteur de 15
minutes sur `SITE-001` (`consumption_kw = null`, `data_quality = critical`,
`consumption_kw_imputed` renseignée, `imputation_method = locf`).

| Contrôle | Résultat |
|----------|----------|
| `GET /api/v1/sites` | 200, 3 sites, sélection initiale sur `SITE-001` (`active`) |
| `GET /readings` | 200, `meta.total = 1439`, deux pages suivies (`offset=0` puis `offset=1000`) |
| Courbe réelle | Tracée sur toute la fenêtre, profil jour/nuit conforme aux données insérées |
| Trou de mesure | Visible dans la courbe ; « 15 mesure(s) absente(s) de la source » affiché |
| Changement de site | `SITE-002` rechargé (`/sites/SITE-002/readings`), échelle passée de 600 à 220 kW, aucune donnée de `SITE-001` conservée |
| Mobile (375 px) | Lisible, graphique et sélecteur empilés |

**Service d'inférence** — `EnerVision-G5/predict@develop` (PR #26 fusionnée),
image `services/serving/Dockerfile` construite et lancée sans registre MLflow
joignable.

| Contrôle | Résultat |
|----------|----------|
| `GET /health` | 200 |
| `POST /api/v1/predict` | **503** — « Aucun modèle chargé depuis `models:/enervision_xgboost@champion` » |
| Affichage dashboard | « Prédiction indisponible » avec le `detail` du service ; les mesures réelles restent affichées |
| Repli automatique | **Aucun** : le JSON de démonstration ne s'active pas sur erreur |

**Mode démonstration** — `VITE_PREDICTION_SOURCE=fixture`

| Contrôle | Résultat |
|----------|----------|
| Bandeau | Affiché, nommant la courbe de prédiction comme simulée |
| Appel réseau vers Predict | Aucun |
| Modèle affiché | `demo-fixture-1.0.0` |
| Mesures | Toujours issues de l'API métier |
| Jonction entre courbes | Aucun point fabriqué entre dernière mesure et première prédiction |

### Ce qui reste à rejouer

- **Prédiction réelle** : impossible ici, faute de modèle publié au registre
  MLflow. À rejouer dès qu'un modèle est entraîné et référencé
  (`models:/enervision_xgboost@champion`), et que l'ETL a publié ses partitions
  de variables.
- **Chaîne de données complète** : les mesures utilisées ont été insérées
  directement en base plutôt que produites par `collector → ETL`. Le chemin de
  lecture (API métier + PostgreSQL + endpoints du contrat) est bien celui de
  production ; seule l'origine des lignes diffère.
- **Appel navigateur sans proxy** : bloqué tant que l'API métier ne publie pas
  d'en-têtes CORS. À rejouer une fois cette autorisation ajoutée côté API.

### Commandes de vérification

```bash
npm ci
npm run lint
npm test
npm run build
```
