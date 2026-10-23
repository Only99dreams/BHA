# BHA Phase 1 — Taxonomy Foundation Implementation

## Overview

This document tracks the implementation of Phase 1 from the BHA Category Taxonomy & CTO Implementation Brief. Phase 1 creates the 22-category taxonomy foundation with subcategories, business types, and category-scoped attributes (filters).

---

## What's Been Built

### Database Migrations

| File | Purpose |
|------|---------|
| `supabase/migrations/001_taxonomy_foundation.sql` | Creates 7 new tables (categories, subcategories, business_categories, category_attributes, business_attribute_values, business_locations, business_type_vocabulary) + legacy_redirects. Seeds all 22 categories with subcategories, 30 business types, and category attributes for key categories. |
| `supabase/migrations/002_migrate_existing_data.sql` | Maps existing 15 industries to new 22 categories, backfills business_categories, sets primary_category_id, maps business types to global vocabulary, creates legacy URL redirects, backfills locations, updates search_text. |
| `supabase/migrations/003_rls_fix_and_status_trigger.sql` | Fixes RLS policies with SECURITY DEFINER function (avoids JWT timing issues), adds server-side state machine enforcement trigger. |
| `supabase/migrations/004_location_hierarchy.sql` | Creates the universal `locations` parent-child tree + `location_slug()` helper, indexes, RLS. Data is loaded by `supabase/migrations/locations/*.sql`. |
| `supabase/migrations/005_country_locale_currency.sql` | Makes language and currency country-specific: adds `currency_code`, `currency_symbol`, `default_locale`, `dial_code`, `timezone` to `countries`; creates `country_languages`; adds `location_currency()`, `location_locale()`, `location_languages()`, `business_currency()`, `business_locale()` resolvers; backfills all 58 countries. |

### Admin UI Components

| File | Purpose |
|------|---------|
| `src/admin/TaxonomyManager.tsx` | Full CRUD for categories, subcategories, and business type vocabulary. Three tabs: Categories, Filters & Attributes, Business Types. |
| `src/admin/AttributeManager.tsx` | CRUD for category attributes (filters). Supports all data types: STRING, NUMBER, BOOLEAN, ENUM, MULTI_ENUM, RANGE. Category-scoped with allowed values. |

### Modified Files

| File | Change |
|------|--------|
| `src/Dashboards.tsx` | Integrated TaxonomyManager into AdminDashboard as a new panel |
| `src/dashboards.css` | Added 100+ lines of taxonomy manager + attribute manager styles (light/dark) |

---

## New Database Tables

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `categories` | 22 top-level categories | name, slug, description, seo_title, seo_description, sort_order, is_active, legacy_industry_id |
| `subcategories` | Second-level groupings | category_id, name, slug, sort_order, is_active |
| `business_categories` | Many-to-many join | business_id, category_id, subcategory_id, is_primary |
| `category_attributes` | Filter definitions | category_id, key, label, data_type, allowed_values, is_searchable, is_required |
| `business_attribute_values` | Per-business filter values | business_id, attribute_id, value, value_jsonb |
| `business_locations` | Structured locations | business_id, location_type, country_code, region, city, address, lat/lng |
| `locations` | Country location hierarchy (57 countries + Burundi, 33,950 locations) | country_code, parent_id, name, location_type, level, path, sort_order, is_active |
| `country_languages` | Languages per country (201 rows, one primary each) | country_code, language_code, name, native_name, is_primary, sort_order |
| `business_type_vocabulary` | Global business types | name, slug, sort_order, is_active |
| `legacy_redirects` | URL redirect mapping | old_slug, new_slug, business_id |

### Location-specific language & currency

Language and currency are resolved from the country a location (or business) belongs to, so a business anywhere in the hierarchy gets its local language and currency without storing them twice.

`countries` carries the per-country defaults:

| Column | Example | Notes |
|---|---|---|
| `currency_code` | `GHS` | ISO 4217, primary currency |
| `currency_symbol` | `GH₵` | display symbol |
| `default_locale` | `en-GH` | BCP-47 |
| `dial_code` | `+233` | international prefix |
| `timezone` | `Africa/Accra` | primary IANA zone |

`country_languages` holds **many** languages per country (one flagged `is_primary`), which African countries need (South Africa has 12 official languages). 201 rows across 58 countries, every country exactly one primary.

Resolvers (all `stable`, usable in queries and policies):

```sql
select public.location_currency(l.id),   -- e.g. 'NGN' for any Nigerian node
       public.location_locale(l.id)      -- e.g. 'en-NG'
from public.locations l where l.path = 'nigeria/lagos-state';

select * from public.location_languages(l.id);  -- primary language first
select public.business_currency(b.id), public.business_locale(b.id) from public.businesses b;
```

`subscription_plans.currency` and `payments.currency` no longer default to `USD`; they must be set explicitly (existing rows keep their stored value).

### Modified `businesses` Table

New columns added:
- `primary_category_id` → FK to categories
- `primary_subcategory_id` → FK to subcategories
- `business_type_vocabulary_id` → FK to business_type_vocabulary
- `verification_status` → UNVERIFIED / PENDING / VERIFIED / FAILED / MANUAL_REVIEW
- `payment_status` → UNPAID / PENDING / PAID / FAILED / REFUNDED
- `publication_status` → DRAFT / IN_REVIEW / APPROVED / PUBLISHED / SUSPENDED / EXPIRED

---

## Migration Mapping

### 15 Old Industries → 22 New Categories

| Old Industry | New Category | Action |
|-------------|-------------|--------|
| Agriculture & Food | Agriculture, Agribusiness & Agricultural Technology | Rename + expand |
| Business Services | Business & Corporate Services | Rename + redistribute financial subcategories |
| Commerce & Retail | Commerce, Retail & E-commerce | Rename |
| Construction | Construction, Engineering & Infrastructure | Rename |
| Creative & Media | Creative, Media & Entertainment | Rename |
| Green Economy | Green Economy, Energy & Environment | Rename |
| Health & Wellness | Health, Medical & Wellness | Rename |
| Hospitality & Tourism | Hospitality, Tourism & Leisure | Rename |
| Logistics | Logistics, Courier & Supply Chain | Rename |
| Manufacturing | Manufacturing & Industrial Production | Rename |
| Professional Services | Professional & Legal Services | Rename |
| Real Estate | Real Estate & Property Services | Rename |
| Education | Education, Schools & Training | Rename |
| Technology | Technology, Software & Digital Services | Rename |
| Transportation | Transportation, Mobility & Aviation | Rename |
| — | Fashion, Beauty & Lifestyle | NEW |
| — | Food, Beverage & Catering | NEW |
| — | Mining, Natural Resources & Commodities | NEW |
| — | Financial Services, Payments & Insurance | NEW |
| — | Events, Conferences & Experiences | NEW |
| — | Home, Repair & Personal Services | NEW |
| — | NGOs, Social Enterprises & Development | NEW |

### Subcategory Redistribution

Financial subcategories from old Business Services → New Financial Services category:
- Financial Advisory → Investment advisory/asset management
- Insurance Services → Insurance companies/brokers
- Loans & Credit Services → Loans/credit
- Investment Advisory → Investment advisory/asset management
- FinTech Services → FinTech/digital payments
- Microfinance Banks → Microfinance banks
- Commercial Banks → Commercial banks
- Banking & Finance → (merged into above)

Remaining Business Services subcategories stay in Business & Corporate Services.

---

## State Machine Enforcement

A PostgreSQL trigger enforces valid status transitions:

```
APPLICATION_STARTED → VERIFICATION_PENDING → VERIFIED / VERIFICATION_FAILED
→ PAYMENT_PENDING → PAID → INFORMATION_PENDING → INFORMATION_RECEIVED
→ AI_PAGE_GENERATING → QUALITY_REVIEW → APPROVED → LIVE
→ RENEWAL_DUE → EXPIRED / SUSPENDED
```

All transitions are logged to `audit_logs`.

---

## How to Run Migrations

1. **Create a Supabase project** (or use existing)
2. **Run migrations in order:**
   ```bash
   # In Supabase SQL editor or via supabase CLI:
   supabase db push
   ```
   Or run each file manually in the SQL editor:
   - `001_taxonomy_foundation.sql`
   - `002_migrate_existing_data.sql`
   - `003_rls_fix_and_status_trigger.sql`

3. **Verify seed data:**
   ```sql
   select count(*) from categories; -- should be 22
   select count(*) from subcategories; -- should be ~250+
   select count(*) from business_type_vocabulary; -- should be 30
   select count(*) from category_attributes; -- should be ~60+
   ```

---

## Admin UI Access

1. Sign in as an ADMIN or REVIEWER user
2. Navigate to `/admin`
3. Scroll to the "Category & Subcategory Management" panel
4. Three tabs available:
   - **Categories**: Create, edit, reorder, activate/deactivate, delete categories and subcategories
   - **Filters & Attributes**: Manage structured filter definitions per category
   - **Business Types**: Manage the global business type vocabulary

---

## RLS Security

All new tables have Row Level Security enabled with:
- **Public read**: Active categories, subcategories, business types (for discovery pages)
- **Admin full access**: Categories, subcategories, attributes, business types (ADMIN/REVIEWER role via SECURITY DEFINER function)
- **Owner manage**: Business categories, attribute values, locations (business owner or admin)

---

## Phase 2 Complete

- [x] Build `/category/:slug` pages with subcategory navigation
- [x] Implement dynamic filter UI on category pages (renders from `category_attributes`)
- [x] Upgrade search to use category-scoped filters
- [x] Implement deduplicated search results
- [x] Create `legacy_redirects` table for old URL → new URL

## Phase 3 Complete

- [x] Build business onboarding multi-step form (8 steps: identity, location, contact, classification, details, media, social, hours)
- [x] Implement AI page generation Edge Function (OpenAI, saves as DRAFT, never auto-publishes)
- [x] Build quality review UI for admins (approve, reject, request changes)
- [x] Implement Flutterwave payment webhook handler (verifies payment, activates subscription, does NOT auto-publish)
- [x] Implement Prembly verification webhook handler (updates verification status)
- [x] Connect full lifecycle: onboarding → AI generation → quality review → approval → live

## Phase 4 Complete

- [x] Stable slug system + redirect middleware for legacy URLs (App.tsx legacy redirect logic)
- [x] XML sitemap generation for SEO (sitemap Edge Function)
- [x] Structured data (Schema.org JSON-LD) for business pages + category pages
- [x] Social sharing metadata (Open Graph, Twitter Cards) via seo.ts helper
- [x] Analytics integration (analytics-track Edge Function)
- [x] robots.txt with sitemap reference
- [x] Related-category discovery on business pages

## Phase 5 Complete

- [x] Search log analysis dashboard (AnalyticsDashboard with page views, top searches, top businesses)
- [x] Taxonomy health metrics (category health table showing empty categories, subcategory counts, filter status)
- [x] Admin feedback loop for taxonomy changes (TaxonomyFeedbackPanel with type selection, logged to audit_logs)
- [x] Versioned taxonomy changes with audit trail (audit_logs table + status transition trigger)
- [x] All phases complete

## Final Acceptance Checklist Status

- [x] All 22 master categories are admin-manageable
- [x] Existing 15 directory types and subcategories are mapped without losing records
- [x] One business can have multiple category associations but one canonical record and landing page
- [x] Business Type is separate from Category/Subcategory
- [x] Filters are configurable and contextual
- [x] Country, region and city are structured fields
- [x] Category pages are SEO-friendly with stable URLs
- [x] Verification, payment, subscription, review and publication are separate states
- [x] AI-generated pages cannot publish without human approval
- [x] No unverified awards, licences, certifications, partnerships or regulatory claims are fabricated
- [x] Taxonomy changes are auditable; architecture is secure, mobile-first and extensible

## Remaining Deployment Tasks

- [ ] Edge Function deployment (`supabase functions deploy`)
- [ ] Set environment variables (OPENAI_API_KEY, FLW_SECRET_KEY, PREMBLY_API_KEY)
- [ ] Supabase Auth hooks for role-based access
- [ ] Performance optimization (caching, CDN)
- [ ] Load testing with production data
- [ ] CI/CD pipeline setup

---

## Verification Checklist (Phase 1)

- [x] All 22 master categories are admin-manageable
- [x] Existing 15 directory types mapped without losing records
- [x] Subcategories seeded for all 22 categories
- [x] Business Type vocabulary seeded (30 values)
- [x] Category attributes seeded for key categories
- [x] Many-to-many business_categories table created
- [x] Business Type is separate from Category/Subcategory
- [x] Filters are configurable and contextual
- [x] RLS policies on all new tables
- [x] Status transition trigger enforces state machine
- [x] Admin UI for taxonomy management
- [ ] Country, region and city are structured fields (partially done — business_locations table)
- [ ] Category pages are SEO-friendly (Phase 2)
- [ ] Verification, payment, publication as separate states (columns added, UI pending)
