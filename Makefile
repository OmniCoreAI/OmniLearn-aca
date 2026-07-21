# OmniLearn — convenience wrapper around docker compose
#
#   make build     Build the images
#   make up        Start the stack in the background (nohup) -> logs/omnilearn.log
#   make down      Stop and remove the containers
#   make logs      Follow the logs
#   make restart   Restart the app container
#   make ps        Show container status
#   make deploy    Run the DigitalOcean deploy script

SHELL := /bin/bash
COMPOSE := docker compose
LOG_DIR := logs
LOG_FILE := $(LOG_DIR)/omnilearn.log
PROD_ENV := .env.production

.PHONY: help build up up-prod down logs restart ps deploy

help:
	@echo "Targets: build | up | up-prod | down | logs | restart | ps | deploy"

build:
	$(COMPOSE) build

up:
	@mkdir -p $(LOG_DIR)
	nohup $(COMPOSE) up --build > $(LOG_FILE) 2>&1 &
	@echo "OmniLearn (dev, .env) is starting in the background (nohup)."
	@echo "Follow logs with: make logs   (file: $(LOG_FILE))"

up-prod:
	@mkdir -p $(LOG_DIR)
	@test -f $(PROD_ENV) || { echo "Missing $(PROD_ENV) — create it first."; exit 1; }
	nohup $(COMPOSE) --env-file $(PROD_ENV) up --build > $(LOG_FILE) 2>&1 &
	@echo "OmniLearn (prod, $(PROD_ENV)) is starting in the background (nohup)."
	@echo "Follow logs with: make logs   (file: $(LOG_FILE))"

down:
	$(COMPOSE) down

logs:
	@tail -f $(LOG_FILE) 2>/dev/null || $(COMPOSE) logs -f

restart:
	$(COMPOSE) restart

ps:
	$(COMPOSE) ps

deploy:
	sudo ./deploy/deploy.sh
