# Image de production du dashboard — build Vite figé, servi en statique par Nginx.
# Multi-stage : le toolchain Node ne suit pas dans l'image finale, qui ne
# contient que les fichiers compilés et Nginx.

# --- Étape 1 : compilation du bundle de production -------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Dépendances d'abord (lock épinglé) pour profiter du cache de couches.
COPY package.json package-lock.json ./
RUN npm ci

# Sources + génération du bundle (tsc -b && vite build -> /app/dist).
COPY . .
RUN npm run build

# --- Étape 2 : service des fichiers statiques -----------------------------
# Image Nginx non-root : écoute sur 8080, tourne en uid 101, aucun toolchain.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Configuration : fallback SPA + cache des assets + /healthz.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Uniquement le résultat du build, rien d'autre du dépôt.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# La commande par défaut de l'image de base lance déjà Nginx au premier plan.
