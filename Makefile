.PHONY: install build test lint static-check validate \
        backend-build backend-test backend-lint backend-static-check \
        pwa-build pwa-test pwa-lint pwa-static-check \
        android-build android-test android-lint android-static-check \
        wear-build wear-test wear-lint wear-static-check

install:
	npm ci

build: backend-build pwa-build android-build wear-build

test: backend-test pwa-test android-test wear-test

lint: backend-lint pwa-lint android-lint wear-lint

static-check: backend-static-check pwa-static-check android-static-check wear-static-check

validate:
	./scripts/validate.sh

backend-build:
	npm run build -w @medsup/backend
backend-test:
	npm run test -w @medsup/backend
backend-lint:
	npm run lint -w @medsup/backend
backend-static-check:
	npm run static-check -w @medsup/backend

pwa-build:
	npm run build -w @medsup/pwa
pwa-test:
	npm run test -w @medsup/pwa
pwa-lint:
	npm run lint -w @medsup/pwa
pwa-static-check:
	npm run static-check -w @medsup/pwa

android-build:
	./gradlew :apps:android:assembleDebug
android-test:
	./gradlew :apps:android:testDebugUnitTest
android-lint:
	./gradlew :apps:android:lintDebug
android-static-check:
	./gradlew :apps:android:check

wear-build:
	./gradlew :apps:wear:assembleDebug
wear-test:
	./gradlew :apps:wear:testDebugUnitTest
wear-lint:
	./gradlew :apps:wear:lintDebug
wear-static-check:
	./gradlew :apps:wear:check
