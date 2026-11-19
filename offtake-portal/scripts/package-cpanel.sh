#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export_dir="$project_dir/out"
archive_dir="$project_dir/dist"
archive_file="$archive_dir/VVD-Offtake-Portal-FINAL.zip"
work_dir="$(mktemp -d)"
stage_dir="$work_dir/site"
trap 'rm -rf "$work_dir"' EXIT

for command in php zip unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$export_dir/index.html" ]]; then
  printf 'Static export not found at %s. Run npm run build first.\n' "$export_dir" >&2
  exit 1
fi
for route in services about mission login register admin-login admin/setup admin manager; do
  if [[ ! -f "$export_dir/$route/index.html" ]]; then
    printf 'Static route is missing from the export: %s/index.html\n' "$route" >&2
    exit 1
  fi
done
if [[ ! -d "$export_dir/_next/static/chunks" ]] || ! find "$export_dir/_next/static/chunks" -type f \( -name '*.css' -o -name '*.js' \) -print -quit | grep -q .; then
  printf 'The export is missing its CSS/JavaScript assets.\n' >&2
  exit 1
fi
mkdir -p "$stage_dir" "$archive_dir"
cp -R "$export_dir/." "$stage_dir/"
cp "$project_dir/.htaccess" "$stage_dir/.htaccess"
mkdir -p "$stage_dir/api"
for file in auth.php bootstrap.php config.example.php health.php money.php offtake.php telegram.php; do
  cp "$project_dir/api/$file" "$stage_dir/api/$file"
done
mkdir -p "$stage_dir/database"
cp "$project_dir/database/offtake-platform-v2.postgresql.sql" "$stage_dir/database/offtake-platform-v2.postgresql.sql"
mkdir -p "$stage_dir/database/migrations"
cp "$project_dir/database/migrations/20261117_manager_supplier_autoprovision.postgresql.sql" "$stage_dir/database/migrations/20261117_manager_supplier_autoprovision.postgresql.sql"
cp "$project_dir/database/migrations/20261118_manager_inventory_workspaces.postgresql.sql" "$stage_dir/database/migrations/20261118_manager_inventory_workspaces.postgresql.sql"
cp "$project_dir/database/migrations/20261118_manager_inventory_workspaces_fix.postgresql.sql" "$stage_dir/database/migrations/20261118_manager_inventory_workspaces_fix.postgresql.sql"
cp "$project_dir/README.md" "$stage_dir/README-CPANEL.md"
php "$project_dir/scripts/write-public-supabase-env.php" "$project_dir" "$stage_dir/.env.local" "$stage_dir/api/config.php"
for route in services about mission login register admin-login admin manager; do
  cp "$stage_dir/$route/index.html" "$stage_dir/$route.html"
done
mkdir -p "$stage_dir/admin"
cp "$stage_dir/admin/setup/index.html" "$stage_dir/admin/setup.html"
node "$project_dir/scripts/inline-export-css.mjs" "$stage_dir"
find "$stage_dir" -type d -exec chmod 755 {} +
find "$stage_dir" -type f -exec chmod 644 {} +
chmod 600 "$stage_dir/.env.local"
chmod 600 "$stage_dir/api/config.php"
php -l "$stage_dir/api/config.php" >/dev/null
php -r '$config = require $argv[1]; if (!is_array($config) || array_keys($config) !== ["supabase_url", "supabase_anon_key"] || $config["supabase_url"] === "" || $config["supabase_anon_key"] === "") { fwrite(STDERR, "The cPanel PHP config must contain only the public Supabase URL and publishable key.\n"); exit(1); }' "$stage_dir/api/config.php"

if find "$stage_dir" -type f \( -name '.env' -o -name '.env.*' \) ! -path "$stage_dir/.env.local" -print -quit | grep -q . \
  || find "$stage_dir" -type f \( -name '*.pem' -o -name '*.key' \) -print -quit | grep -q .; then
  printf 'Refusing to package a file that may contain credentials.\n' >&2
  exit 1
fi
if [[ "$(wc -l < "$stage_dir/.env.local")" -ne 2 ]] \
  || ! grep -q '^NEXT_PUBLIC_SUPABASE_URL=https://' "$stage_dir/.env.local" \
  || ! grep -q '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$stage_dir/.env.local"; then
  printf 'The deployment environment file must contain only the public Supabase URL and publishable key.\n' >&2
  exit 1
fi

rm -f "$archive_file"
(cd "$stage_dir" && zip -qr "$archive_file" .)
unzip -t "$archive_file" >/dev/null
archive_entries="$(unzip -Z1 "$archive_file")"
for path in index.html services/index.html services.html about/index.html about.html mission/index.html mission.html login/index.html login.html register/index.html register.html admin-login/index.html admin-login.html admin/index.html admin.html admin/setup/index.html admin/setup.html manager/index.html manager.html api/auth.php api/offtake.php api/health.php api/telegram.php api/money.php api/config.example.php api/config.php database/offtake-platform-v2.postgresql.sql database/migrations/20261117_manager_supplier_autoprovision.postgresql.sql database/migrations/20261118_manager_inventory_workspaces.postgresql.sql database/migrations/20261118_manager_inventory_workspaces_fix.postgresql.sql .htaccess .env.local; do
  if ! grep -Fxq "$path" <<< "$archive_entries"; then
    printf 'Required deployment file is missing from the ZIP: %s\n' "$path" >&2
    exit 1
  fi
done
if ! grep -Eq '^_next/static/chunks/[^/]+\.css$' <<< "$archive_entries"; then
  printf 'The ZIP is missing its compiled stylesheet.\n' >&2
  exit 1
fi
if ! grep -Eq '^_next/static/chunks/[^/]+\.js$' <<< "$archive_entries"; then
  printf 'The ZIP is missing its compiled JavaScript chunks.\n' >&2
  exit 1
fi
for page in index.html services.html about.html mission.html login/index.html login.html register/index.html register.html admin-login/index.html admin-login.html admin/index.html admin.html admin/setup/index.html admin/setup.html manager/index.html manager.html; do
  page_html="$(unzip -p "$archive_file" "$page")"
  if ! grep -q 'data-offtake-inline="true"' <<< "$page_html"; then
    printf 'The ZIP page is missing its embedded stylesheet: %s\n' "$page" >&2
    exit 1
  fi
  if grep -q 'data-offtake-inline-script="true"' <<< "$page_html"; then
    printf 'The ZIP page should load JavaScript from external chunks: %s\n' "$page" >&2
    exit 1
  fi
  script_assets="$(grep -oE 'src="[^"]*/_next/static/chunks/[^"]+\.js"' <<< "$page_html" | sed -E 's/^src="([^"]*)"$/\1/; s#^/##' | sort -u || true)"
  if [[ -z "$script_assets" ]]; then
    printf 'The ZIP page does not reference its external JavaScript chunks: %s\n' "$page" >&2
    exit 1
  fi
  while IFS= read -r asset; do
    if ! grep -Fxq "$asset" <<< "$archive_entries"; then
      printf 'The ZIP is missing JavaScript asset %s referenced by %s.\n' "$asset" "$page" >&2
      exit 1
    fi
  done <<< "$script_assets"
done
for page in login/index.html register/index.html admin/index.html manager/index.html; do
  page_html="$(unzip -p "$archive_file" "$page")"
  if grep -q 'Checking your account' <<< "$page_html" \
    || ! grep -q 'name="email"' <<< "$page_html" \
    || ! grep -Eq '<form[^>]*method="post"' <<< "$page_html"; then
    printf 'The ZIP auth page must render its form without waiting for JavaScript: %s\n' "$page" >&2
    exit 1
  fi
done
admin_page_html="$(unzip -p "$archive_file" admin/index.html)"
manager_page_html="$(unzip -p "$archive_file" manager/index.html)"
register_page_html="$(unzip -p "$archive_file" register/index.html)"
if ! grep -Fq 'name="company_name"' <<< "$register_page_html"; then
  printf 'The manager registration page must require a company name for automatic workspace setup.\n' >&2
  exit 1
fi
login_page_html="$(unzip -p "$archive_file" login/index.html)"
if grep -Eq 'Platform administrator\?|href="/admin-login/"' <<< "$login_page_html"; then
  printf 'The manager login page must not expose administrator sign-in.\n' >&2
  exit 1
fi
if ! grep -Fq 'action="/api/auth.php?action=admin_login"' <<< "$admin_page_html"; then
  printf 'The /admin/ page must contain the administrator sign-in form.\n' >&2
  exit 1
fi
if ! grep -Fq 'action="/api/auth.php?action=login"' <<< "$manager_page_html"; then
  printf 'The /manager/ page must render its manager sign-in form immediately.\n' >&2
  exit 1
fi
admin_setup_page_html="$(unzip -p "$archive_file" admin/setup/index.html)"
if ! grep -Fq 'Supabase SQL Editor' <<< "$admin_setup_page_html" \
  || grep -Fq 'action="/api/auth.php?action=admin_setup"' <<< "$admin_setup_page_html"; then
  printf 'The admin setup page must explain trusted Supabase bootstrap and not expose a public setup form.\n' >&2
  exit 1
fi

if grep -Eq '(^|/)(node_modules|\.next)/|(^|/)\.env$' <<< "$archive_entries" \
  || awk '$0 ~ /(^|\/)\.env[^/]*$/ && $0 != ".env.local" { found = 1 } END { exit !found }' <<< "$archive_entries"; then
  printf 'Unexpected development or environment file found in the archive.\n' >&2
  exit 1
fi
if [[ "$(unzip -p "$archive_file" .env.local | wc -l)" -ne 2 ]] \
  || ! unzip -p "$archive_file" .env.local | grep -q '^NEXT_PUBLIC_SUPABASE_URL=https://' \
  || ! unzip -p "$archive_file" .env.local | grep -q '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='; then
  printf 'The ZIP does not contain the sanitized Supabase environment file.\n' >&2
  exit 1
fi

printf 'Created and verified %s\n' "$archive_file"
