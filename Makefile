# Makefile — front (Vite + React + TS) en environnement de dev Docker
#
# Usage : make <cible>   (ex: make up, make sh, make logs)

COMPOSE := docker compose -f compose.dev.yaml
SERVICE := front

.DEFAULT_GOAL := help

## help : liste les cibles disponibles
.PHONY: help
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/^## /  /'

## up : construit si besoin et démarre le serveur de dev (http://localhost:5173)
.PHONY: up
up:
	$(COMPOSE) up

## up-d : idem mais en arrière-plan
.PHONY: up-d
up-d:
	$(COMPOSE) up -d

## build : (re)construit l'image (à faire quand package.json change)
.PHONY: build
build:
	$(COMPOSE) build

## rebuild : reconstruit l'image sans cache et redémarre
.PHONY: rebuild
rebuild:
	$(COMPOSE) up --build --force-recreate

## down : arrête et supprime les containers
.PHONY: down
down:
	$(COMPOSE) down

## restart : redémarre le service
.PHONY: restart
restart:
	$(COMPOSE) restart

## logs : affiche les logs en continu
.PHONY: logs
logs:
	$(COMPOSE) logs -f

## sh : ouvre un shell dans le container
.PHONY: sh
sh:
	$(COMPOSE) exec $(SERVICE) sh

## install : installe les dépendances dans le container (make install pkg=react-router-dom)
.PHONY: install
install:
	$(COMPOSE) exec $(SERVICE) npm install $(pkg)

## lint : lance eslint dans le container
.PHONY: lint
lint:
	$(COMPOSE) exec $(SERVICE) npm run lint

## clean : arrête tout et supprime le volume node_modules
.PHONY: clean
clean:
	$(COMPOSE) down -v
