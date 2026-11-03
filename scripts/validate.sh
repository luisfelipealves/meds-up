#!/usr/bin/env bash
set -u

failures=0
run() {
  printf '\n==> %s\n' "$*"
  "$@" || failures=$((failures + 1))
}

run npm run build
run npm test
run npm run lint
run npm run static-check
run ./gradlew :apps:android:assembleDebug
run ./gradlew :apps:android:testDebugUnitTest
run ./gradlew :apps:android:lintDebug
run ./gradlew :apps:android:check
run ./gradlew :apps:wear:assembleDebug
run ./gradlew :apps:wear:testDebugUnitTest
run ./gradlew :apps:wear:lintDebug
run ./gradlew :apps:wear:check

if (( failures > 0 )); then
  printf '\nvalidation failed: %d command(s) failed\n' "$failures" >&2
  exit 1
fi
printf '\nall validation commands passed\n'
