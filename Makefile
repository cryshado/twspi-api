#!make

ifneq ($(wildcard .env),)
    include .env
endif

.PHONY: setup_db_url

npx_start_scansr: setup_db_url
	@DATABASE_URL=$(DATABASE_URL) npx ts-node src/cmd/scansr/index.ts

npx_start_pubapi: setup_db_url
	@DATABASE_URL=$(DATABASE_URL) npx ts-node src/cmd/pubapi/index.ts

npx_addpools: setup_db_url
	@DATABASE_URL=$(DATABASE_URL) npx ts-node src/cmd/scripts/addpools.ts

npx_prisma_migrate: setup_db_url
	@DATABASE_URL=$(DATABASE_URL) npx prisma migrate deploy

npx_prisma_generate:
	npx prisma generate

tsc_build:
	yarn build

dc_run_pubapi:
	docker-compose up --build -d pubapi

dc_run_scansr:
	docker-compose up --build -d scansr

dc_run_db:
	docker-compose up --build -d postgres

setup_db_url:
	$(eval DATABASE_URL := \
	"postgresql://$(DB_USER):$(DB_PASS)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=$(DB_SSLM)")
