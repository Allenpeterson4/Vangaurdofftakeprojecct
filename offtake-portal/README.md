# Vanguard Offtake Portal

An independent mobile-first portal for supplier-company onboarding, daily
allocations, dispatch tracking, and weekly settlements. Its cPanel deployment
uses a statically exported Next.js/React frontend and same-origin PHP/MySQL APIs;
the production site does not require Node.js hosting or Supabase.

## cPanel requirements

- Apache hosting with `.htaccess` and `mod_rewrite` enabled.
- PHP 8.1+ with PDO, `pdo_mysql`, and cURL enabled (`mbstring` is recommended).
- MySQL 8.0.16+ or compatible MariaDB with generated columns and CHECK constraints.
- HTTPS enabled on the subdomain. HTTPS is required for PWA installation.

## Install on cPanel

1. Create a MySQL database and database user in cPanel, and grant the user
   privileges on that database.
2. Import [`database/offtake-portal.sql`](./database/offtake-portal.sql) in
   phpMyAdmin. The schema uses `offtake_`-prefixed table names so it can also
   share a database without colliding with the marketplace tables.
3. In cPanel File Manager, copy `api/config.example.php`, name the copy
   `config.php`, and edit it with the cPanel database host, port, name, username,
   and password. Leave it inside the `api` directory; its `.htaccess` denies
   direct web access. Do not upload a `.env` file: this PHP backend reads
   `api/config.php`. The source `api/config.php` is excluded from Git and from
   deployment ZIPs so database credentials are not accidentally published.
4. Configure Telegram notifications in the private `api/config.php`:
   create a bot with Telegram's `@BotFather`, add it to the preferred channel
   as an administrator with permission to post, then set `telegram_bot_token`
   and `telegram_chat_id` in the config. Use the channel's `@username` or
   numeric chat ID. Never send or publish the bot token. Successful manager
   registrations, sign-ins, and allocation status changes are queued and sent
   to this channel. Delivery is attempted immediately; failed notifications
   are recorded and logged without blocking sign-in or dashboard actions. The
   persistent **Install app** button in the site header installs the PWA where
   supported or shows device-specific add-to-home-screen instructions.
5. If updating an existing database, import
   [`database/migrations/20261114_telegram_notifications.sql`](./database/migrations/20261114_telegram_notifications.sql)
   in phpMyAdmin to add the notification queue. New databases get this table
   from the full schema. For an existing installation, also import
   [`database/migrations/20261115_telegram_delivery_status.sql`](./database/migrations/20261115_telegram_delivery_status.sql)
   so failed delivery attempts are recorded accurately. If an earlier portal
   version had a scheduled Telegram worker, remove its old scheduled task and
   delete `api/telegram-worker.php` if it is still on the server; this version
   does not require background jobs.
6. Point the subdomain's document root to an empty folder, then upload and
   extract `dist/VVD-Offtake-Portal-FINAL.zip` into that folder. To update an
   existing deployment, extract the new ZIP over the document root and choose
   overwrite/replace for existing files. The archive intentionally does not
   include `api/config.php`; keep that file in place. If using the generated
   ZIP, the SQL file is included under `database/` but denied over HTTP; use
   phpMyAdmin to import it.
7. Visit the HTTPS subdomain and register the platform owner's account. Managers
   and administrators can sign in through `/login/` or the dedicated
   `/admin-login/` page; successful sign-in
   routes administrators to `/admin/` and managers to `/manager/`. In
   phpMyAdmin, promote that account to the first administrator, replacing the
   email in this statement:

   ```sql
   UPDATE `offtake_users`
   SET `role` = 'admin', `supplier_id` = NULL
   WHERE `email` = 'owner@example.com' AND `role` = 'manager';
   ```

   Confirm one row was changed, then sign in again. The administrator can add
   supplier companies and create allocations. Company managers register at
   `/register`; assign them to a supplier in the admin dashboard before they
   can see company data.

The public site includes `/services/`, `/about/`, and `/mission/` pages. It is
designed for its own subdomain document root. Do not mount it under a
marketplace URL path. Keep `api/config.php` private and never publish database
credentials. The package includes flat HTML fallbacks for the portal routes;
Apache rewrites the route URLs to those files so they do not depend on
directory-index behavior.

## Build the cPanel ZIP

Requires Node.js/npm for the build and the `zip` and `unzip` command-line tools:

```sh
npm install
npm run typecheck
npm run lint
npm run package:cpanel
```

The verified archive is created at
[`dist/VVD-Offtake-Portal-FINAL.zip`](./dist/VVD-Offtake-Portal-FINAL.zip). It contains
the static export, PHP APIs, protected SQL schema, Apache rules, and this
deployment guide. It does not contain `node_modules`, build caches, or
environment files. Do not upload the source workspace or its development
dependencies to production. Compiled CSS and the Next.js JavaScript chunks
referenced by each page are embedded into the exported HTML. This avoids
depending on the host correctly serving separate CSS/JavaScript chunk requests.

To develop the frontend locally, run `npm run dev`. The PHP API must also be
available under the same origin for login and dashboard workflows. Set
`NEXT_PUBLIC_CURRENCY` before building if amounts should display in a currency
other than USD.

## Runtime and data protection

- PHP sessions use HttpOnly, SameSite cookies; POST requests require a
  same-origin check and a session-bound CSRF token.
- Passwords use PHP's `password_hash`/`password_verify`. Login attempts are
  rate-limited per email and source IP.
- All database access uses PDO prepared statements and role checks. Managers
  can only read and update batches belonging to their assigned supplier.
- Dashboard API requests have a 15-second deadline and surface a timeout or
  backend error instead of leaving the dashboard in an endless loading state.
- MySQL generated columns calculate deployed capital, revenue, and net credit.
  The browser never supplies those totals.
- Status changes are written to `offtake_status_audit`; completed allocations
  cannot be reopened through the API.
- The service worker caches the app shell and static GET assets only. It never
  caches API responses or session data.
- Manager and administrator sign-in are routed independently. The dedicated
  administrator sign-in rejects manager accounts instead of redirecting them
  to the company dashboard.
- The install prompt supports the browser install flow and provides home-screen
  instructions for browsers, including Safari on iOS.

Public registration creates manager-role accounts. Set up the first admin
using the SQL bootstrap above; there is no public admin registration route.

The header includes an **Install app** button for the PWA. Browsers that support
installation open the native install prompt; other browsers show instructions
for adding the portal to the home screen.

Check PHP, database connectivity, and every required table/column at
`https://your-subdomain.example/api/health.php`. It reports actionable setup
errors without exposing database credentials, along with whether Telegram is
configured.
