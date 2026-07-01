#!/usr/bin/env bash

set -uo pipefail

failures=0
step_names=()
step_statuses=()

if [[ -f pnpm-lock.yaml ]]; then
  package_manager="pnpm"
elif [[ -f yarn.lock ]]; then
  package_manager="yarn"
else
  package_manager="npm"
fi

print_header() {
  printf '\n============================================================\n'
  printf '%s\n' "$1"
  printf '============================================================\n'
}

record_status() {
  step_names+=("$1")
  step_statuses+=("$2")
  printf '%s: %s\n' "$1" "$2"
}

has_npm_script() {
  node -e '
    const fs = require("fs");
    const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
    process.exit(Object.prototype.hasOwnProperty.call(packageJson.scripts || {}, process.argv[1]) ? 0 : 1);
  ' "$1"
}

run_package_script() {
  case "$package_manager" in
    pnpm) pnpm run "$1" ;;
    yarn) yarn run "$1" ;;
    *) npm run "$1" ;;
  esac
}

run_script_step() {
  local label="$1"
  local script_name="$2"

  print_header "$label"
  if ! has_npm_script "$script_name"; then
    record_status "$label" "SKIPPED (no such npm script)"
    return
  fi

  if run_package_script "$script_name"; then
    record_status "$label" "PASS"
  else
    record_status "$label" "FAIL"
    failures=$((failures + 1))
  fi
}

printf 'BluePrintAI Shopify review check\n'
printf 'Package manager: %s\n' "$package_manager"

print_header "Prisma validation"
if [[ -d prisma ]] && find prisma -name schema.prisma -type f -print -quit | grep -q . && \
  node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    process.exit(dependencies.prisma || dependencies["@prisma/client"] ? 0 : 1);
  '; then
  if npx prisma validate; then
    record_status "Prisma validation" "PASS"
  else
    record_status "Prisma validation" "FAIL"
    failures=$((failures + 1))
  fi
else
  record_status "Prisma validation" "SKIPPED (Prisma not detected)"
fi

run_script_step "Lint" "lint"
run_script_step "Typecheck" "typecheck"
run_script_step "Build" "build"
run_script_step "Test" "test"

print_header "Summary"
printf '%-24s | %s\n' "Step" "Status"
printf '%-24s-+-%s\n' "------------------------" "-----------------------------------"
for ((index = 0; index < ${#step_names[@]}; index++)); do
  printf '%-24s | %s\n' "${step_names[$index]}" "${step_statuses[$index]}"
done
printf '\nFailures: %d\n' "$failures"

if ((failures > 0)); then
  exit 1
fi

exit 0
