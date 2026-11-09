# Business Hub Africa

A mobile-first business discovery experience built with React, TypeScript, Vite, and Supabase. Businesses are read live from Supabase; there is no sample or fallback business data in the UI.

The supplied light and dark logos are `public/logo_nobackgroung.png` and `public/logo_blackbackground.jpg`. Brand colors use the logo's navy (`#092d67`), green (`#18c832`), and orange (`#ff6b00`).

The interface includes a persistent light/dark theme, email/password account signup and login, real owner onboarding, a landing-page editor, and owner/admin dashboards backed by live Supabase data.

## Run locally

```sh
npm install
npm run dev
```

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project API settings.
3. Run `supabase/schema.sql` in the Supabase SQL editor, then run every file in `supabase/migrations/` in numerical order. `006_owner_workflow.sql` is required: it adds the owner write policies, the public profile read policy, and the audit policies that the onboarding, editor, and review flows depend on.
4. In Supabase Auth URL Configuration, add your local and production URLs to the allowed redirect URLs so email confirmation can return to `/login?confirmed=1`.
5. Create an account for each trusted admin/reviewer, then assign roles in the SQL editor. For example, replace the email below with the account's email:

	```sql
	insert into public.user_roles (user_id, role)
	select id, 'ADMIN' from auth.users where email = 'admin@example.com'
	on conflict do nothing;
	```

6. Deploy the `generate-ai-page` Edge Function and set `GROQ_API_KEY` (preferred) or `OPENAI_API_KEY` as a function secret. Without either key the app still creates a usable draft from the business details, but AI generation is skipped. Optionally set `PEXELS_API_KEY` (preferred) or `UNSPLASH_ACCESS_KEY` so regenerated pages source real stock photos matched to the business sector and location. Without a photo key the function uses a curated set of relevant Unsplash images, and owner uploads always take priority.
7. Restart the Vite server. Discovery, dashboards, and onboarding will read and write live Supabase records.

Only the public anon key belongs in the browser. Never expose the service-role key or payment/verification provider secrets in a `VITE_` variable.

## End-to-end flow

1. **Sign up** at `/signup`. With email confirmation disabled, the new account is sent straight to `/onboarding`.
2. **Onboard the business** at `/onboarding`: identity, location, contact details, taxonomy, description, services, media, social links, and opening hours. A draft page version is always created. New businesses then call the AI generator, which saves a new DRAFT version and moves the business to `QUALITY_REVIEW`.
3. **Owner dashboard** at `/dashboard` shows the real business, profile completion, page versions, subscription, enquiry and booking counts. From here the owner can preview, edit or (re)generate the landing page.
4. **Landing page editor** at `/dashboard/page` edits SEO, hero copy, hero and about images, about, services, proof points, process steps, FAQs, gallery images and contact copy. Owners can save a DRAFT or submit it for review. A live business keeps its published page while edits are reviewed. Regenerating a page asks the AI to review the business details first and collect a few clarifying answers where information is missing, then writes the full website (hero, about, services, reasons to choose the business, process, gallery, FAQ and contact) and sources relevant photos. The preview frame renders the same full website as the public page and has Regenerate and Open-in-new-window actions at the top.
5. **Admin review** at `/admin#quality-review` publishes a page version, marks the business verified, and moves it through `QUALITY_REVIEW → APPROVED → LIVE`. Public pages render the latest `PUBLISHED` version; owners can preview draft versions with `/business/:slug?preview=:version`.

## Current scope

The first slice includes public discovery filters, business profile pages, configurable plans, email/password authentication, an admin/reviewer route gate, real owner and admin dashboards, business onboarding and editing, a landing-page editor, AI page drafting, and the database foundation for taxonomy, applications, plans, promotions, subscriptions, payments, verification records, webhooks, page versions, enquiries, bookings, roles, and audit logs.

Prembly and Flutterwave provider calls still require trusted server-side credentials before they can be exercised. Never place Prembly API credentials in browser code or `VITE_` variables.
