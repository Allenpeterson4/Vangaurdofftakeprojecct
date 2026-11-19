# Vanguard Offtake Portal

Responsive operations portal for manager registration, supplier allocations,
dispatch tracking, and weekly settlements. Next.js serves the interface; PHP
calls Supabase Auth/PostgREST using the project URL and publishable (anon) key.
Auth tokens use Secure, HttpOnly cookies scoped to the API, avoiding dependence
on cPanel PHP session storage. The public key does not bypass Row Level Security
or grant schema-editing privileges.

## Supabase setup

The application no longer connects directly to PostgreSQL/MySQL and does not
run database migrations from a local CLI. Apply the schema once using the
Supabase Dashboard's **SQL Editor**:

1. For local development, copy `api/config.example.php` to `api/config.php`,
   or provide these values as process environment variables / in the ignored
   root `.env.local`:

   ```text
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
   ```

   The PHP API reads the same URL/key. The deployment script writes only these
   two public values to the ZIP's root `.env.local` and `api/config.php`; it
   validates that the key is publishable or has the legacy `anon` role. Do not
   use a service-role key or database password.
2. Open `database/offtake-platform-v2.postgresql.sql` in the Supabase SQL
   Editor and run it as a project administrator. It creates the Auth-linked
   manager/admin profiles, operational tables, status auditing, payout RPC,
   access policies, and signup triggers. The SQL is idempotent for a fresh
   installation; it does not delete existing tables.
3. Run
   `database/migrations/20261118_manager_inventory_workspaces.postgresql.sql`
   after the base schema, followed by
   `database/migrations/20261118_manager_inventory_workspaces_fix.postgresql.sql`.
   If the workspace/inventory migration was already applied, run only the
   follow-up migration to correct the inventory payout calculation.
4. Check `/api/health.php`. A healthy response reports seven checked tables.
   If tables were just created and PostgREST reports them missing, reload the
   schema cache from Supabase or wait briefly and retry.
5. Create the first admin user in **Supabase Dashboard → Authentication →
   Users**. The Auth signup trigger creates a manager profile for email users
   by default. In SQL Editor, replace the placeholders below with that Auth
   user's UUID, email, and name to grant admin access:

   ```sql
   BEGIN;
   DELETE FROM public.offtake_v2_managers
   WHERE id = 'AUTH-USER-UUID';
   INSERT INTO public.offtake_v2_admins (id, email, full_name)
   VALUES ('AUTH-USER-UUID', 'admin@example.com', 'Portal Administrator');
   COMMIT;
   ```

   The `/admin/setup/` page explains this trusted bootstrap. The public API
   intentionally cannot promote an account to administrator.

   To check why an existing account is not being recognized, run this query
   in the **Supabase SQL Editor** (not cPanel phpMyAdmin) and replace the email:

   ```sql
   SELECT
     u.id,
     u.email,
     (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
     CASE
       WHEN a.id IS NOT NULL AND a.is_active THEN 'admin'
       WHEN m.id IS NOT NULL AND m.is_active THEN 'manager'
       WHEN a.id IS NOT NULL OR m.id IS NOT NULL THEN 'disabled'
       ELSE 'no portal role'
     END AS portal_role,
     m.supplier_id,
     s.name AS supplier_name
   FROM auth.users AS u
   LEFT JOIN public.offtake_v2_admins AS a ON a.id = u.id
   LEFT JOIN public.offtake_v2_managers AS m ON m.id = u.id
   LEFT JOIN public.offtake_v2_suppliers AS s ON s.id = m.supplier_id
   WHERE lower(u.email) = lower('YOUR_LOGIN_EMAIL');
   ```

   If this returns an Auth user with `no portal role` and the account should
   be a manager, create its profile with this idempotent repair query:

   ```sql
   INSERT INTO public.offtake_v2_managers (id, email, full_name, is_active)
   SELECT
     u.id,
     u.email,
     CASE
       WHEN CHAR_LENGTH(BTRIM(COALESCE(u.raw_user_meta_data ->> 'full_name', ''))) >= 2
         THEN LEFT(BTRIM(u.raw_user_meta_data ->> 'full_name'), 160)
       WHEN CHAR_LENGTH(SPLIT_PART(u.email, '@', 1)) >= 2
         THEN LEFT(SPLIT_PART(u.email, '@', 1), 160)
       ELSE 'Manager'
     END,
     TRUE
   FROM auth.users AS u
   WHERE lower(u.email) = lower('YOUR_LOGIN_EMAIL')
     AND NOT EXISTS (
       SELECT 1 FROM public.offtake_v2_admins AS a WHERE a.id = u.id
     )
   ON CONFLICT (id) DO UPDATE
     SET email = EXCLUDED.email,
         is_active = TRUE,
         updated_at = now();
   ```

   The password must still belong to that user in **Supabase Auth**. The
   separate MySQL tables shown in phpMyAdmin store operational records only;
   this portal does not use them to authenticate or store passwords.
6. Managers register at `/register/` with their company name. The Auth trigger
   creates a dedicated supplier record for that manager and links the manager
   to it, so signup does not wait for admin assignment. When Supabase returns
   an Auth session, the app redirects straight to `/manager/`. If email
   confirmation is enabled, Supabase requires confirmation before dashboard
   access. The administrator signs in separately at `/admin/`; admins can
   later assign one or more company workspaces. Managers can switch only
   between workspaces explicitly assigned to them.
7. Configure shipment alerts in private `api/config.php` or the server
   environment. Set `ADMIN_ALERT_EMAIL`, `ALERT_FROM_EMAIL`,
   `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID`. The PHP host must have its
   mail transport configured for `mail()` to deliver email. `/api/health.php`
   reports whether Telegram and email settings are present; it never exposes
   the credentials.

The SQL is intended for a fresh Supabase schema. The separate
`database/offtake-portal.sql` file is a MySQL 8.0.16+ reference schema matching
the current operational table columns and financial formulas. It does not
recreate Supabase Auth, triggers, RPCs, or row-level security, and this
application does not connect to or use those MySQL tables. Running it creates
a separate MySQL copy only; it does not configure or migrate the live portal.

## Local development and deployment

Requirements: Node.js/npm and PHP 8.1+ with the cURL extension.
No PDO driver, Composer packages, database host, or database password is
needed.

```sh
npm install
npm run dev
```

The development server serves Next.js and proxies `/api/*` to the local PHP
server. If accessing it through a non-local forwarded origin, set `APP_ORIGIN`
to that exact origin (scheme, host, and optional port). For production, build
the static UI and deployment ZIP:

```sh
npm run typecheck
npm run lint
npm run test:auth
php tests/money.php
npm run package:cpanel
```

Upload `dist/VVD-Offtake-Portal-FINAL.zip` to the domain's document root and
extract all files there, overwriting the existing deployment. Keep the
`_next/static/chunks/` directory; it contains the JavaScript required for
interactive controls, and `.htaccess` sets its JavaScript/CSS MIME types. The
ZIP includes the public Supabase URL/key in both a sanitized root `.env.local`
and `api/config.php`. The PHP config provides a fallback for cPanel extractors
that skip hidden files; `.htaccess` blocks direct web access to both files.
Private alert settings, Composer dependencies, and database credentials are
not packaged. This app still uses Supabase, not the separate MySQL reference
schema. After upgrading from a server-session build, sign in once to establish
the new API cookies. Run `/api/health.php` and complete the SQL Editor setup
above.

## Access controls

- The shared header offers a light/dark theme toggle on public pages and
  manager/admin account views. The browser remembers the choice and syncs it
  across open portal tabs.
- Supabase Auth owns passwords, sessions, confirmation, and sign-in throttling.
  The PHP API stores access and refresh tokens in Secure, HttpOnly, SameSite
  cookies scoped to `/api/`; a separate HttpOnly CSRF cookie is checked with
  same-origin validation. Login does not depend on PHP session persistence.
- Manager profiles and a separate supplier workspace are created by a trusted
  Auth trigger. The submitted company name is display data only; the supplier
  ID and manager link are generated server-side. Manager and admin roles are
  derived from protected profile rows, never from client metadata. Admin
  profiles can only be added by a trusted SQL Editor operator.
- RLS scopes manager data to explicitly assigned supplier memberships. Admins
  manage those memberships, and managers can switch only among their assigned
  workspaces. Batch ownership and lifecycle transitions are validated in
  PostgreSQL.
- Managers can create inventory batches and edit their details only before
  funding. The lifecycle is `pending` → `paid` → `in_transit` → `completed`.
  The manager dashboard keeps batch entry collapsed until **Add Product** is
  selected and   remembers the last values per manager and workspace in that browser; all
  fields remain editable. Its totals show deployed capital and completed sales
  revenue across the workspace, active batches, and the current weekly investor
  payout.
  A transition to in-transit attempts both a Telegram Bot API alert and an
  email alert; the UI reports if either delivery fails.
- The signed-in account menu provides account details and password changes
  after verifying the current password. Administrators can jump from the menu
  to the manager user-management section.
- Inventory purchase amount is the total batch capital, wholesale supply price
  is per unit, and sales discount is a percentage of gross sales. Supabase
  computes discounted revenue, gross profit, a configurable manager allowance
  (15% by default, applied only to positive gross profit), and the net payout
  due to the purchasing company. Completed batches feed the weekly payout
  ledger. Legacy allocation records keep their prior accounting model.
- Weekly payouts are recorded through an admin-only transaction-safe RPC;
  clients cannot submit the payout amount directly.
- The publishable/anon key is public by design. Never put a Supabase
  service-role key in the browser, PHP config, environment file, or ZIP.
- The previous local ORM/CLI schema installer, custom PHP password tables,
  MySQL runtime, and Telegram queue are not used by this Supabase Auth + RLS
  deployment.
