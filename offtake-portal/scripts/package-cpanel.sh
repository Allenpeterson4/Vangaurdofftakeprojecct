#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export_dir="$project_dir/out"
archive_dir="$project_dir/dist"
archive_file="$archive_dir/VVD-Offtake-Portal-FINAL.zip"
work_dir="$(mktemp -d)"
stage_dir="$work_dir/site"
trap 'rm -rf "$work_dir"' EXIT

for command in zip unzip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$export_dir/index.html" ]]; then
  printf 'Static export not found at %s. Run npm run build first.\n' "$export_dir" >&2
  exit 1
fi
for route in services about mission login register admin-login admin manager; do
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
cp -R "$project_dir/api" "$stage_dir/api"
cp -R "$project_dir/database" "$stage_dir/database"
cp "$project_dir/README.md" "$stage_dir/README-CPANEL.md"
rm -f "$stage_dir/api/config.php"
cp "$project_dir/api/config.example.php" "$stage_dir/api/config.example.php"
for route in services about mission login register admin-login admin manager; do
  cp "$stage_dir/$route/index.html" "$stage_dir/$route.html"
done
node "$project_dir/scripts/inline-export-css.mjs" "$stage_dir"
find "$stage_dir" -type d -exec chmod 755 {} +
find "$stage_dir" -type f -exec chmod 644 {} +

if find "$stage_dir" -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name '*.key' \) -print -quit | grep -q .; then
  printf 'Refusing to package a file that may contain credentials.\n' >&2
  exit 1
fi

rm -f "$archive_file"
(cd "$stage_dir" && zip -qr "$archive_file" .)
unzip -t "$archive_file" >/dev/null
archive_entries="$(unzip -Z1 "$archive_file")"
for path in index.html services/index.html services.html about/index.html about.html mission/index.html mission.html login/index.html login.html register/index.html register.html admin-login/index.html admin-login.html admin/index.html admin.html manager/index.html manager.html api/auth.php api/offtake.php api/health.php api/telegram.php api/config.example.php database/offtake-portal.sql database/migrations/20261114_telegram_notifications.sql database/migrations/20261115_telegram_delivery_status.sql .htaccess; do
  if ! grep -Fxq "$path" <<< "$archive_entries"; then
    printf 'Required deployment file is missing from the ZIP: %s\n' "$path" >&2
    exit 1
  fi
done
if ! grep -Eq '^_next/static/chunks/[^/]+\.css$' <<< "$archive_entries"; then
  printf 'The ZIP is missing its compiled stylesheet.\n' >&2
  exit 1
fi
for page in index.html services.html about.html mission.html login/index.html login.html register/index.html register.html admin-login/index.html admin-login.html admin/index.html admin.html manager/index.html manager.html; do
  page_html="$(unzip -p "$archive_file" "$page")"
  if ! grep -q 'data-offtake-inline="true"' <<< "$page_html"; then
    printf 'The ZIP page is missing its embedded stylesheet: %s\n' "$page" >&2
    exit 1
  fi
  if ! grep -q 'data-offtake-inline-script="true"' <<< "$page_html" \
    || grep -Eq '<script[^>]+src=[^>]*_next/static/chunks/[^>]+\.js' <<< "$page_html"; then
    printf 'The ZIP page is missing embedded JavaScript or still depends on external chunks: %s\n' "$page" >&2
    exit 1
  fi
done
for page in login/index.html register/index.html admin-login/index.html; do
  page_html="$(unzip -p "$archive_file" "$page")"
  if grep -q 'Checking your account' <<< "$page_html" \
    || ! grep -q 'name="email"' <<< "$page_html" \
    || ! grep -Eq '<form[^>]*method="post"' <<< "$page_html"; then
    printf 'The ZIP auth page must render its form without waiting for JavaScript: %s\n' "$page" >&2
    exit 1
  fi
done

if grep -Eq '(^|/)(node_modules|\.next|\.env[^/]*)/|(^|/)\.env[^/]*$' <<< "$archive_entries"; then
  printf 'Unexpected development or environment file found in the archive.\n' >&2
  exit 1
fi

printf 'Created and verified %s\n' "$archive_file"
