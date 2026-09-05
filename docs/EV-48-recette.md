# EV-48 — Recette

Procédure de recette de l'authentification et de la mise en page d'après la
maquette « Smart Energy Optimiser », et relevé de ce qui a réellement été
vérifié.

## 1. Démarrer les services

### Base de données, schéma et comptes

L'API vérifie désormais un jeton : il lui faut la table `app_user`, donc le
schéma du repo **infra**, et non plus seulement des mesures.

```bash
git clone --branch develop https://github.com/EnerVision-G5/infra.git
cd infra/enervision-db && cp .env.example .env   # renseigner POSTGRES_PASSWORD
docker compose up -d
```

Les scripts d'`initdb/` créent le schéma et les sept sites de référence au
**premier** démarrage seulement (volume vide). Pour les rejouer :
`docker compose down -v`.

Puis les comptes de développement, hors d'`initdb/` et donc à appliquer
explicitement :

```bash
docker compose exec -e DEV_USERS_PASSWORD='changeme-dev' timescaledb \
    psql -U enervision -d enervision -f /dev-seed/01_dev_users.sql
```

> **Point bloquant relevé en recette du 03/09/2026.** Ce seed écrit un hachage
> **bcrypt** (`crypt(..., gen_salt('bf', 12))`, via pgcrypto), alors que
> `app/password.py` de l'API ne vérifie que de l'**argon2id** et refuse tout
> hachage d'un autre algorithme. Les deux comptes existent donc en base mais
> aucun ne peut se connecter : `POST /auth/token` répond 401 sur le mot de passe
> pourtant correct — y compris avec la commande `curl` du README de l'API.
>
> Le contournement local, en attendant la correction côté infra :
>
> ```bash
> HASH=$(docker exec <conteneur-api> python -c \
>     "from argon2 import PasswordHasher; print(PasswordHasher().hash('changeme-dev'))")
> docker compose exec timescaledb psql -U enervision -d enervision \
>     -c "UPDATE app_user SET password_hash = '$HASH' WHERE oauth_provider='local';"
> ```

### API métier

```bash
git clone --branch develop https://github.com/EnerVision-G5/api.git
cd api && cp .env.example .env
# JWT_SECRET est vide dans .env.example : en generer un, sinon l'API ne demarre pas.
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Laisser **`AUTH_ENABLED=true`** : c'est tout l'objet de cette recette. Faire
pointer `DATABASE_URL` sur la base ci-dessus plutôt que sur le service `db` du
compose de l'API, qui démarre un Postgres nu, sans schéma.

### Dashboard

```bash
cp .env.example .env.local
```

Passer par le proxy de développement, qui évite le cross-origin (l'API métier
n'autorise que les origines listées dans `CORS_ALLOWED_ORIGINS`) :

```bash
VITE_API_BASE_URL=/proxy/api
VITE_DEV_PROXY_API_TARGET=http://localhost:8080
VITE_PREDICTION_SOURCE=fixture
```

`fixture` parce que le service d'inférence n'était pas démarré pour cette
recette : la courbe de prédiction vient du JSON versionné, **les mesures restent
réelles**, et le bandeau « Données de démonstration » le dit à l'écran.

```bash
npm ci
npm run dev
```

## 2. Points à contrôler

### Authentification

| # | Attendu | Vérifié le 03/09/2026 |
|---|---|---|
| 1 | `http://localhost:5173/` sans session affiche l'écran de connexion, pas le dashboard | oui |
| 2 | Soumettre le formulaire vide affiche « Ce champ est obligatoire. » sous chaque champ et n'appelle pas l'API | oui |
| 3 | Un mauvais mot de passe affiche « Identifiants invalides. » et laisse la saisie en place | oui, 401 réel de l'API |
| 4 | `dev.reader` / `changeme-dev` ouvre la session et bascule sur le dashboard | oui |
| 5 | Les appels suivants portent `Authorization: Bearer …` | oui, `GET /sites` en 200 |
| 6 | Le bouton « Se déconnecter » ramène à l'écran de connexion | oui |
| 7 | Un 401 en cours de session ferme la session et ramène au formulaire, sans geste de l'utilisateur | oui, voir ci-dessous |
| 8 | Un rechargement de page ramène à l'écran de connexion | oui, comportement voulu : le jeton vit en mémoire |

**Comment le point 7 a été provoqué** — plutôt que d'attendre l'échéance d'une
heure, l'utilisateur porteur du jeton a été retiré côté base :

```bash
docker compose exec timescaledb psql -U enervision -d enervision \
    -c "UPDATE app_user SET oauth_subject='dev.reader.suspendu' WHERE oauth_subject='dev.reader';"
```

Le jeton reste bien signé, mais `get_current_user` ne trouve plus son porteur et
répond 401. Au rafraîchissement suivant du panneau temps réel (30 s au plus),
l'écran est revenu de lui-même au formulaire de connexion. Restaurer ensuite le
compte avec l'`UPDATE` inverse.

### Mise en page

| # | Attendu | Vérifié le 03/09/2026 |
|---|---|---|
| 9 | En-tête « Smart Energy Optimiser », sélecteur de site, utilisateur connecté et son rôle | oui, `dev.reader · reader` |
| 10 | À droite de l'en-tête, la puissance souscrite et la localisation du site choisi | oui, `Puissance souscrite 200 kW` / `Paris, France · office · active` |
| 11 | Les trois zones de la maquette : consommation temps réel, recommandations, indicateurs | oui |
| 12 | Le panneau temps réel affiche puissance, tension, intensité, température, humidité | oui, `119 kW`, `399,2 V`, `133,9 A`, `21,9 °C`, `56,7 %` |
| 13 | Changer de site met à jour l'en-tête, le panneau temps réel et le graphique | oui, SITE001 → SITE002 |
| 14 | Une mesure de plus de deux minutes signale un retard d'ingestion | oui, apparu sur SITE002 dont la dernière mesure datait |
| 15 | Le panneau recommandations ne montre aucune donnée et dit pourquoi | oui, renvoi au contrat 1.2.0 et à EV-32 |
| 16 | Le graphique d'EV-16 reste intact sous « Indicateurs » | oui, deux courbes et bandeau de démonstration |

## 3. Reprise après la montée de l'API en 1.1.0

`api@develop` a intégré EV-38 (`c52b2d2`) : le contrat gelé passe en **1.1.0**,
`GET /sites/{site_id}/predictions` apparaît, et `POST /api/v1/predict` disparaît
du contrat de l'API métier. Les types du dashboard ont été régénérés
(`npm run gen:types`), sans changement de code applicatif.

La recette a été rejouée en entier contre cette version. Les seize points du
§ 2 repassent. Deux constats s'y ajoutent.

### Le front tourne en local sans le service d'inférence

Avec `VITE_PREDICTION_SOURCE=api` et aucun service d'inférence démarré, le
dashboard reste **entièrement utilisable** : sites, sélecteur, panneau temps
réel et courbe de consommation réelle sont servis, et la prédiction échoue
proprement dans son propre encart — « Prédiction indisponible · Le service
d'inférence a renvoyé une erreur serveur (502) » — sans effacer les mesures.
C'est le comportement voulu : les deux flux échouent indépendamment.

### Second écart api ↔ infra : la table `prediction`

`GET /sites/{site_id}/predictions` répond **500** contre une base construite
depuis `infra/enervision-db/initdb/` :

```
UndefinedColumnError: column prediction.lower_bound_kw does not exist
```

`app/models/prediction.py` déclare `generated_at`, `lower_bound_kw` et
`upper_bound_kw`, que `01_schema.sql` ne contient pas. Aucune migration ne les
ajoute — ni dans `alembic/versions/` (vide), ni dans `initdb/`, alors que les
colonnes d'imputation de `mesure` avaient reçu leur propre
`03_mesure_imputation.sql`.

C'est le même motif que l'écart bcrypt / argon2 ci-dessus : le modèle ORM de
l'API a évolué sans que le schéma d'infra suive. Sans objet pour EV-48, dont le
périmètre exclut la prédiction, mais bloquant pour EV-38 dès qu'on voudra lire
une prédiction réelle.

## 4. Ce qui n'a pas été vérifié

- **L'échéance réelle du jeton** au bout d'une heure : le minuteur est couvert
  par les tests avec une horloge factice, pas en recette manuelle.
- **La prédiction réelle** : le service d'inférence n'était pas démarré, la
  recette a tourné en mode `fixture`.
- **Le rôle `writer`** : aucun endpoint d'écriture n'existe au contrat gelé.
- **La route `/predictions`** du contrat 1.1.0 décrite par le guide
  d'intégration : elle n'est pas dans le contrat gelé sur `develop`, qui est en
  1.0.0. Le dashboard s'en tient au contrat.
