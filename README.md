# Business Hub Africa

A mobile-first business discovery experience built with React, TypeScript, Vite, and Supabase. The discovery UI uses local sample businesses until Supabase credentials are configured.

The supplied light and dark logos are `public/logo_nobackgroung.png` and `public/logo_blackbackground.jpg`. Brand colors use the logo's navy (`#092d67`), green (`#18c832`), and orange (`#ff6b00`).

The interface includes a persistent light/dark theme, email/password account signup and login, and owner/admin dashboards. Dashboard figures and queue records remain sample data; account-specific business workflows are not yet connected.

## Run locally

```sh
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. In Supabase Auth URL Configuration, add your local and production URLs to the allowed redirect URLs so email confirmation can return to `/login?confirmed=1`.
5. Create an account for each trusted admin/reviewer, then assign roles in the SQL editor. For example, replace the email below with the account's email:

	```sql
	insert into public.user_roles (user_id, role)
	select id, 'ADMIN' from auth.users where email = 'admin@example.com'
	on conflict do nothing;
	```

6. Restart the Vite server. The business grid and country/industry taxonomy will read published records from Supabase.

Only the public anon key belongs in the browser. Never expose the service-role key or payment/verification provider secrets in a `VITE_` variable.

## Current scope

The first slice includes public discovery filters, business profile pages, configurable plan previews, email/password authentication, an admin/reviewer route gate, owner and admin dashboards, responsive layout, and the database foundation for business profiles, taxonomy, applications, plans, promotions, subscriptions, payments, verification records, webhooks, page versions, enquiries, bookings, roles, and audit logs.

Prembly and Flutterwave calls, authenticated business onboarding/data workflows, and AI page generation require trusted server-side endpoints and provider credentials; they are not simulated as successful flows in this client. Never place Prembly API credentials in browser code or `VITE_` variables.
