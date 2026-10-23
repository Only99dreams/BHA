import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronDown, Compass, ExternalLink, Globe2, Mail, MapPin, Menu, Moon, Phone, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, hasSupabaseConfig, type BusinessListing } from './supabase'
import { Brand } from './Brand'
import { AdminDashboard, BusinessDashboard } from './Dashboards'
import { AuthScreen } from './Auth'
import { CategoryPage } from './pages/CategoryPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { generateBusinessStructuredData } from './lib/seo'
import './bha.css'

const previewIndustries = ['Agriculture & Food', 'Business Services', 'Commerce & Retail', 'Construction', 'Creative & Media', 'Education', 'Green Economy', 'Health & Wellness', 'Hospitality & Tourism', 'Logistics', 'Manufacturing', 'Professional Services', 'Real Estate', 'Technology', 'Transportation']
const previewCountries = ['All countries', 'Ghana', 'Kenya', 'Nigeria', 'Rwanda', 'South Africa', 'Uganda']

const sampleBusinesses: BusinessListing[] = [
  { id: 'sample-1', slug: 'the-terrace-accra', business_name: 'The Terrace Accra', short_description: 'A considered stay in the heart of Accra, with thoughtful rooms and a rooftop made for slow evenings.', country: 'Ghana', city: 'Accra', industry: 'Hospitality & Tourism', business_type: 'Boutique Hotel', cover_image_url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: true, email: 'hello@terrace-accra.example' },
  { id: 'sample-2', slug: 'savanna-collective', business_name: 'Savanna Collective', short_description: 'Smallholder-grown, traceable shea and botanical ingredients from northern Ghana.', country: 'Ghana', city: 'Tamale', industry: 'Agriculture & Food', business_type: 'Agricultural Producer', cover_image_url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: false },
  { id: 'sample-3', slug: 'moyo-studio', business_name: 'Moyo Studio', short_description: 'A Nairobi-based architecture practice shaping purposeful spaces for a changing city.', country: 'Kenya', city: 'Nairobi', industry: 'Construction', business_type: 'Architecture Studio', cover_image_url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: false },
  { id: 'sample-4', slug: 'northstar-health', business_name: 'Northstar Health', short_description: 'Accessible, people-first primary care connecting communities to better everyday health.', country: 'Nigeria', city: 'Lagos', industry: 'Health & Wellness', business_type: 'Health Clinic', cover_image_url: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: false },
  { id: 'sample-5', slug: 'kivu-roasters', business_name: 'Kivu Roasters', short_description: 'Exceptional Rwandan coffee, sourced close to origin and roasted with care in Kigali.', country: 'Rwanda', city: 'Kigali', industry: 'Commerce & Retail', business_type: 'Coffee Roaster', cover_image_url: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: false },
  { id: 'sample-6', slug: 'studio-nala', business_name: 'Studio Nala', short_description: 'Independent design and digital storytelling for brands building what comes next.', country: 'South Africa', city: 'Cape Town', industry: 'Creative & Media', business_type: 'Design Studio', cover_image_url: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85', is_verified: true, is_booking_enabled: false },
]

type SubscriptionPlan = {
  id: string
  name: string
  standard_price: number
  currency: string
  booking_enabled: boolean
  features: string[]
}

const previewPlans: SubscriptionPlan[] = [
  { id: 'basic', name: 'Basic', standard_price: 45, currency: 'USD', booking_enabled: false, features: ['Professional business page', 'Verified business presence', 'Products, services & gallery', 'Search visibility'] },
  { id: 'booking', name: 'Business Visibility + Booking', standard_price: 65, currency: 'USD', booking_enabled: true, features: ['Everything in Basic', 'Booking functionality'] },
]

function displayValue(value: BusinessListing['country'] | BusinessListing['industry'] | BusinessListing['business_type']) {
  return typeof value === 'string' ? value : value?.name ?? ''
}

function BusinessPage({ business, isLoading }: { business?: BusinessListing; isLoading: boolean }) {
  const [relatedCategories, setRelatedCategories] = useState<{ name: string; slug: string }[]>([])

  useEffect(() => {
    if (!business || !hasSupabaseConfig) return
    // Fetch related categories (same industry, different businesses)
    const client = getSupabaseClient()
    client
      .from('categories')
      .select('name, slug')
      .eq('is_active', true)
      .neq('name', displayValue(business.industry))
      .limit(4)
      .then(({ data }) => {
        if (data) setRelatedCategories(data as { name: string; slug: string }[])
      })
  }, [business])

  // Inject structured data
  useEffect(() => {
    if (!business) return
    const schema = generateBusinessStructuredData({
      name: business.business_name,
      description: business.short_description,
      url: `${window.location.origin}/business/${business.slug}`,
      image: business.cover_image_url,
      city: business.city,
      country: displayValue(business.country),
      phone: business.phone ?? null,
      email: business.email ?? null,
      website: business.website ?? null,
      category: displayValue(business.industry),
      businessType: displayValue(business.business_type),
      verified: business.is_verified,
      services: business.services ?? [],
      datePublished: null,
    })
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = schema
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [business])

  if (!business && isLoading) return <main className="profile-state" role="status">Loading business profile…</main>
  if (!business) return <main className="profile-state"><h1>This business page isn't available.</h1><a href="/">Back to discovery <ArrowRight size={15} /></a></main>

  const countryName = displayValue(business.country)
  const industryName = displayValue(business.industry)
  const typeName = displayValue(business.business_type)
  const email = business.email
  const phone = business.phone
  const website = business.website
  const services = business.services ?? []

  return <div className="profile-shell">
    <header className="profile-header"><Brand href="/" /><a className="profile-back" href="/"><ArrowLeft size={15} /> Back to discovery</a></header>
    <main>
      <div className="profile-cover"><img src={business.cover_image_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=85'} alt={`${business.business_name} cover`} /><div className="profile-cover-overlay" /><div className="profile-cover-label"><span className="live-dot" /> A BUSINESS WORTH KNOWING</div></div>
      <section className="profile-content">
        <div className="profile-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> {industryName} <span className="meta-dot" /> {typeName}</div><h1>{business.business_name}</h1><p><MapPin size={15} /> {business.city}, {countryName}</p></div>{business.is_verified && <span className="profile-verified"><BadgeCheck size={16} /> BHA VERIFIED</span>}</div>
        <div className="profile-columns"><div className="profile-main"><section className="profile-section"><div className="eyebrow"><span className="eyebrow-line" /> ABOUT THE BUSINESS</div><h2>Built with purpose.<br /><em>Ready to be found.</em></h2><p>{business.short_description}</p></section>{services.length > 0 && <section className="profile-section"><div className="eyebrow"><span className="eyebrow-line" /> WHAT THEY DO</div><h2>Products & services</h2><div className="profile-services">{services.map((service) => <article key={service.name}><h3>{service.name}</h3><p>{service.description}</p></article>)}</div></section>}</div>
          <aside className="profile-contact"><span className="eyebrow"><span className="eyebrow-line" /> START A CONVERSATION</span><h2>Good things<br />start with hello.</h2>{email && <a href={`mailto:${email}`}><Mail size={16} /> Email the business <ArrowRight size={15} /></a>}{phone && <a href={`tel:${phone}`}><Phone size={16} /> Call the business <ArrowRight size={15} /></a>}{website && <a href={website} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Visit their website <ArrowRight size={15} /></a>}{business.is_booking_enabled && <button type="button" disabled>Booking enquiries coming soon</button>}<p>Business identity verified by Business Hub Africa.</p></aside>
        </div>
      </section>
    </main>
    {relatedCategories.length > 0 && <section className="related-categories"><div className="eyebrow"><span className="eyebrow-line" /> EXPLORE MORE</div><h2>Discover other businesses</h2><div className="related-grid">{relatedCategories.map((cat) => <a key={cat.slug} href={`/category/${cat.slug}`} className="related-card"><Building2 size={16} /><span>{cat.name}</span><ArrowRight size={14} /></a>)}</div></section>}
    <footer className="site-footer"><Brand className="footer-wordmark" href="/" /><span className="footer-tagline">CREDIBILITY THAT CROSSES BORDERS.</span><span className="footer-copy">© 2026 BUSINESS HUB AFRICA</span></footer>
  </div>
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('bha-theme') === 'dark' ? 'dark' : 'light')
  const [businesses, setBusinesses] = useState<BusinessListing[]>(hasSupabaseConfig ? [] : sampleBusinesses)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('All countries')
  const [industry, setIndustry] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [industryOptions, setIndustryOptions] = useState(previewIndustries)
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([])
  const [countryOptions, setCountryOptions] = useState(previewCountries)
  const [plans, setPlans] = useState<SubscriptionPlan[]>(hasSupabaseConfig ? [] : previewPlans)
  const [promotionPercent, setPromotionPercent] = useState(hasSupabaseConfig ? 0 : 80)
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(hasSupabaseConfig)
  const [adminRoleResult, setAdminRoleResult] = useState<{ userId: string; allowed: boolean } | null>(null)
  const routeSlug = window.location.pathname.startsWith('/business/') ? decodeURIComponent(window.location.pathname.slice('/business/'.length)) : ''
  const isAdminRoleLoading = hasSupabaseConfig && window.location.pathname === '/admin' && Boolean(session) && adminRoleResult?.userId !== session?.user.id
  const canReviewAdmin = adminRoleResult?.userId === session?.user.id && adminRoleResult?.allowed === true

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('bha-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let isCurrent = true
    const client = getSupabaseClient()
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (isCurrent) {
        setSession(nextSession)
        setIsAuthLoading(false)
      }
    })
    void client.auth.getSession().then(({ data }) => {
      if (isCurrent) {
        setSession(data.session)
        setIsAuthLoading(false)
      }
    })
    return () => {
      isCurrent = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig || window.location.pathname !== '/admin' || !session) return

    let isCurrent = true
    const checkAdminRole = async () => {
      const { data, error } = await getSupabaseClient()
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .in('role', ['ADMIN', 'REVIEWER'])
      if (!isCurrent) return
      setAdminRoleResult({ userId: session.user.id, allowed: !error && Boolean(data?.length) })
    }
    void checkAdminRole()
    return () => { isCurrent = false }
  }, [session])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let isCurrent = true
    const loadTaxonomy = async () => {
      const [countryResult, categoryResult] = await Promise.all([
        getSupabaseClient().from('countries').select('name').eq('is_active', true).order('name'),
        getSupabaseClient().from('categories').select('id, name, slug').eq('is_active', true).order('sort_order'),
      ])
      if (!isCurrent) return
      if (countryResult.data?.length) setCountryOptions(['All countries', ...countryResult.data.map((item) => item.name)])
      if (categoryResult.data?.length) {
        setIndustryOptions(categoryResult.data.map((item) => item.name))
        setCategories(categoryResult.data)
      }
    }
    void loadTaxonomy()

    // Legacy URL redirect: /industry/:slug → /category/:slug
    const checkLegacyRedirect = async () => {
      const path = window.location.pathname
      if (!path.startsWith('/industry/')) return
      const oldSlug = decodeURIComponent(path.slice('/industry/'.length))
      const { data } = await getSupabaseClient()
        .from('legacy_redirects')
        .select('new_slug')
        .eq('old_slug', `industry/${oldSlug}`)
        .single()
      if (data?.new_slug) {
        window.location.replace(`/${data.new_slug}`)
      }
    }
    void checkLegacyRedirect()

    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let isCurrent = true
    const loadPlans = async () => {
      const client = getSupabaseClient()
      const [planResult, promotionResult] = await Promise.all([
        client.from('subscription_plans').select('id, name, standard_price, currency, booking_enabled, features').eq('is_active', true).order('standard_price'),
        client.from('promotions').select('discount_percent, starts_at, ends_at').eq('is_active', true).order('created_at', { ascending: false }),
      ])
      if (!isCurrent) return
      if (planResult.data) setPlans(planResult.data as unknown as SubscriptionPlan[])
      const now = Date.now()
      const activePromotion = promotionResult.data?.find((item) => (!item.starts_at || new Date(item.starts_at).getTime() <= now) && (!item.ends_at || new Date(item.ends_at).getTime() >= now))
      setPromotionPercent(activePromotion?.discount_percent ?? 0)
    }
    void loadPlans()
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let isCurrent = true
    const loadBusinesses = async () => {
      let request = getSupabaseClient().from('businesses').select('id, slug, business_name, short_description, country:countries(name), city, industry:industries(name), business_type:business_types(name), cover_image_url, is_verified, is_booking_enabled, phone, email, website, services:business_services(name, description)').eq('status', 'LIVE').eq('is_published', true).order('published_at', { ascending: false })
      if (country !== 'All countries') request = request.eq('country.name', country)
      if (industry) request = request.eq('industry.name', industry)
      if (businessType) request = request.eq('business_type.name', businessType)
      if (query.trim()) request = request.ilike('search_text', `%${query.trim()}%`)
      const { data, error } = await request
      if (!isCurrent) return
      if (!error && data) setBusinesses(data as unknown as BusinessListing[])
      if (error) setBusinesses([])
      setIsLoading(false)
    }
    void loadBusinesses()
    return () => { isCurrent = false }
  }, [country, industry, businessType, query])

  useEffect(() => {
    if (!hasSupabaseConfig || !industry) return
    let isCurrent = true
    const loadTypes = async () => {
      const { data } = await getSupabaseClient().from('business_types').select('name, industry:industries!inner(name)').eq('is_active', true).eq('industry.name', industry).order('name')
      if (isCurrent) setTypes((data ?? []).map((item) => item.name))
    }
    void loadTypes()
    return () => { isCurrent = false }
  }, [industry])

  const visibleBusinesses = hasSupabaseConfig ? businesses : sampleBusinesses.filter((business) => {
    const normalizedQuery = query.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || `${business.business_name} ${business.short_description} ${business.city} ${business.country} ${business.industry} ${business.business_type}`.toLowerCase().includes(normalizedQuery)
    return matchesQuery && (country === 'All countries' || business.country === country) && (!industry || business.industry === industry) && (!businessType || business.business_type === businessType)
  })

  const changeIndustry = (value: string) => {
    setIndustry(value)
    setBusinessType('')
    if (hasSupabaseConfig) setTypes([])
    else setTypes(value ? [...new Set(sampleBusinesses.filter((business) => displayValue(business.industry) === value).map((business) => displayValue(business.business_type)).filter(Boolean))] : [])
  }
  const clearFilters = () => { setQuery(''); setCountry('All countries'); changeIndustry('') }
  const startApplication = () => window.location.assign('/signup')
  const signOut = async () => {
    if (hasSupabaseConfig) await getSupabaseClient().auth.signOut()
    window.location.assign('/')
  }

  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light')
  if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
    return <AuthScreen mode={window.location.pathname === '/signup' ? 'signup' : 'login'} />
  }
  const categorySlug = window.location.pathname.startsWith('/category/') ? decodeURIComponent(window.location.pathname.slice('/category/'.length)) : ''
  if (categorySlug) return <CategoryPage categorySlug={categorySlug} />
  if (routeSlug) return <BusinessPage business={businesses.find((business) => business.slug === routeSlug)} isLoading={isLoading} />
  if (window.location.pathname === '/dashboard') {
    if (isAuthLoading) return <main className="profile-state" role="status">Checking your account…</main>
    if (!session) return <AuthScreen mode="login" />
    return <BusinessDashboard theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} />
  }
  if (window.location.pathname === '/onboarding') {
    if (isAuthLoading) return <main className="profile-state" role="status">Checking your account…</main>
    if (!session) return <AuthScreen mode="login" />
    return <OnboardingPage session={session} onComplete={() => window.location.assign('/dashboard')} />
  }
  if (window.location.pathname === '/admin') {
    if (hasSupabaseConfig && (isAuthLoading || isAdminRoleLoading)) return <main className="profile-state" role="status">Checking admin access…</main>
    if (hasSupabaseConfig && !session) return <AuthScreen mode="login" />
    if (hasSupabaseConfig && !canReviewAdmin) return <main className="profile-state"><h1>Admin access required.</h1><a href="/">Back to discovery <ArrowRight size={15} /></a></main>
    return <AdminDashboard theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} />
  }

  return <div className="site-shell">
    <div className="announcement-bar"><span className="announcement-dot" /> AFRICAN BUSINESSES, OPEN TO THE WORLD <span className="announcement-divider">/</span> <a href="#how-it-works">OUR APPROACH <ArrowRight size={12} /></a><span className="announcement-right">A NEW KIND OF BUSINESS PRESENCE <ArrowDownRight size={14} /></span></div>
    <header className="site-header"><Brand href="#top" label="Business Hub Africa home" /><button className="mobile-menu-button" type="button" aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X size={21} /> : <Menu size={21} />}</button><nav className={`main-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation"><a href="#discover" onClick={() => setIsMenuOpen(false)}>Discover businesses</a><a href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</a><a href="#plans" onClick={() => setIsMenuOpen(false)}>For businesses</a><a href="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</a><a href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</a><a href="/login" onClick={() => setIsMenuOpen(false)}>Sign in</a><button className="theme-toggle public-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="nav-cta" type="button" onClick={startApplication}>Get your business online <ArrowRight size={15} /></button></nav></header>

    <main id="top">
      <section className="hero-section" aria-labelledby="hero-title"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> CREDIBILITY AND VISIBILITY</div><h1 id="hero-title">Discover trusted African businesses <em>and services.</em></h1><ul className="hero-trust"><li>Verified</li><li>Compliance-Ready</li><li>Export-Ready</li></ul><div className="hero-bottomline"><p>Businesses across Africa!</p><a className="text-link" href="#discover">Explore the network <ArrowRight size={15} /></a></div><div className="hero-stamp"><Globe2 size={15} /><span>54 COUNTRIES<br /><b>ONE CONTINENT</b></span></div></div><div className="hero-image-wrap"><img className="hero-image" src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=90" alt="Modern African city skyline seen through architectural glass" /><div className="hero-image-shade" /><div className="hero-image-caption"><span className="caption-index">01 / 54</span><span>BUSINESS IS MOVING.<br /><b>BE THERE TO MEET IT.</b></span><ArrowDownRight size={19} /></div><div className="hero-image-label"><span className="live-dot" /> BUILT FOR BUSINESS ACROSS AFRICA</div></div></section>

      <section className="proof-strip" aria-label="Business Hub Africa benefits"><div className="proof-item"><span className="proof-icon"><ShieldCheck size={18} /></span><div><b>Identity, verified</b><span>Trust starts with knowing</span></div></div><span className="proof-separator" /><div className="proof-item"><span className="proof-icon"><Building2 size={18} /></span><div><b>A page of your own</b><span>Your business, presented well</span></div></div><span className="proof-separator" /><div className="proof-item"><span className="proof-icon"><Compass size={18} /></span><div><b>Found beyond borders</b><span>Visibility that travels</span></div></div><span className="proof-note">GET VERIFIED. GET ONLINE. GET DISCOVERED.</span></section>

      <section className="discovery-section" id="discover" aria-labelledby="discover-title"><div className="section-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> THE BHA BUSINESS NETWORK</div><h2 id="discover-title">Find your next <em>good business.</em></h2></div><p>Explore credible businesses building across the continent. Start with a place, an industry, or a name.</p></div>
        {!hasSupabaseConfig && <div className="preview-notice"><Sparkles size={15} /><span>Preview mode</span><span>Showing sample businesses. Connect Supabase to publish live profiles.</span><a href="#connect">Setup details <ArrowRight size={13} /></a></div>}
        <div className="search-panel" role="search"><label className="keyword-field"><Search size={19} /><span className="sr-only">Search businesses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, service, or keyword" /></label><label className="select-field"><MapPin size={17} /><span className="sr-only">Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}>{countryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><label className="select-field"><Building2 size={17} /><span className="sr-only">Industry</span><select value={industry} onChange={(event) => changeIndustry(event.target.value)}><option value="">All industries</option>{industryOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><label className="select-field type-select"><span className="sr-only">Business type</span><select value={businessType} disabled={!industry || types.length === 0} onChange={(event) => setBusinessType(event.target.value)}><option value="">{industry ? 'All business types' : 'Choose industry first'}</option>{types.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><button className="search-button" type="button" onClick={() => document.getElementById('business-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Explore <ArrowRight size={16} /></button></div>
        <div className="results-toolbar"><div className="results-count"><span className="results-count-number">{hasSupabaseConfig ? (isLoading ? '—' : visibleBusinesses.length) : visibleBusinesses.length.toString().padStart(2, '0')}</span><span>BUSINESSES<br />TO GET TO KNOW</span></div><div className="results-controls"><span className="results-location"><MapPin size={14} /> {country === 'All countries' ? 'Across Africa' : country}</span><span className="sort-divider" /><button className="sort-button" type="button" onClick={clearFilters}>Clear filters <X size={14} /></button></div></div>
        {visibleBusinesses.length > 0 ? <div className="business-grid" id="business-grid">{visibleBusinesses.map((business, index) => { const catSlug = categories.find((c) => c.name === displayValue(business.industry))?.slug; return <article className="business-card" key={business.id} style={{ animationDelay: `${index * 70}ms` }}><a className="business-image-link" href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}><img className="business-image" src={business.cover_image_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85'} alt={`${business.business_name} business profile`} loading="lazy" />{business.is_verified && <span className="verified-pill"><BadgeCheck size={13} /> BHA VERIFIED</span>}{business.is_booking_enabled && <span className="booking-pill">BOOKABLE</span>}</a><div className="business-card-body"><div className="business-card-meta">{catSlug && <a href={`/category/${catSlug}`} className="card-category-link">{displayValue(business.industry)}</a>}<span className="meta-dot" /><span>{displayValue(business.business_type)}</span></div><h3><a href={`/business/${business.slug}`}>{business.business_name}</a></h3><p>{business.short_description}</p><div className="business-card-footer"><span><MapPin size={13} /> {business.city}, {displayValue(business.country)}</span><a href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}><ArrowRight size={17} /></a></div></div></article>})}</div> : isLoading ? <div className="empty-state" role="status">Loading the business network…</div> : <div className="empty-state"><Search size={24} /><h3>No businesses found just yet</h3><p>Try a different keyword or clear a filter to explore more of the network.</p><button type="button" onClick={clearFilters}>Clear all filters <ArrowRight size={14} /></button></div>}
        <div className="directory-bottom"><span>GOOD BUSINESS KNOWS NO BORDERS.</span><a href="#discover">Explore the network <ArrowRight size={15} /></a></div>
      </section>

        <section className="business-invite" id="plans"><div className="invite-number">02 <span>/ YOUR TURN</span></div><div className="invite-copy"><div className="eyebrow"><span className="eyebrow-line" /> BUILT FOR THE BUSINESS YOU'RE BUILDING</div><h2>Make your business<br />easier to <em>believe in.</em></h2><p>We verify who you are, shape your business into a professional online presence, and help the right people find you.</p><button className="invite-button" type="button" onClick={startApplication}>Get your business online <ArrowRight size={16} /></button></div><div className="invite-art"><img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1000&q=85" alt="A business team working together around a table" loading="lazy" /><div className="invite-art-label"><span>01</span><span>YOUR STORY<br /><b>DESERVES TO TRAVEL.</b></span></div></div></section>

        <section className="plans-section" id="plan-prices"><div className="plans-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> AN ANNUAL PRESENCE, BUILT AROUND YOU</div><h2>Choose how you<br /><em>show up.</em></h2></div><p>Every plan starts with verification and a professionally presented business page. Choose booking tools when they fit your business.</p></div><div className="plan-grid">{plans.map((plan) => <article className={`plan-card ${plan.booking_enabled ? 'plan-card-featured' : ''}`} key={plan.id}>{promotionPercent > 0 && <span className="plan-promo">LAUNCH OFFER · {promotionPercent}% OFF</span>}<div className="plan-card-title"><h3>{plan.name}</h3>{plan.booking_enabled && <span>BOOKING INCLUDED</span>}</div><div className="plan-price"><strong>{new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(plan.standard_price * (1 - promotionPercent / 100))}</strong><span>/ year</span>{promotionPercent > 0 && <del>{new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(plan.standard_price)}</del>}</div><div className="plan-rule" /><ul>{plan.features.map((feature) => <li key={feature}><Check size={14} /> {feature}</li>)}</ul><button type="button" onClick={startApplication}>Get started <ArrowRight size={15} /></button></article>)}</div></section>

      <section className="how-section" id="how-it-works"><div className="how-heading"><div className="eyebrow"><span className="eyebrow-line" /> A CLEARER WAY TO BE SEEN</div><h2>From first hello<br />to <em>found online.</em></h2><p>One guided journey. A real person reviewing every business before it goes live.</p></div><div className="steps-list"><div className="step-row"><span className="step-number">01</span><div><h3>Verify your business</h3><p>Confirm your business identity through our trusted verification partner.</p></div><Check size={16} /></div><div className="step-row"><span className="step-number">02</span><div><h3>Choose your plan</h3><p>Pick the annual presence that fits. Add booking tools if your business needs them.</p></div><Check size={16} /></div><div className="step-row"><span className="step-number">03</span><div><h3>Tell us your story</h3><p>Share your details, services, photographs, and the facts that make you, you.</p></div><Check size={16} /></div><div className="step-row"><span className="step-number">04</span><div><h3>Review, then go live</h3><p>We shape a polished business page, check it with you, and publish when it is ready.</p></div><ArrowRight size={16} /></div></div></section>

      <section className="closing-band"><span>FROM AFRICA</span><div className="closing-globe"><Globe2 size={19} /></div><span>TO THE GLOBE.</span><button type="button" onClick={startApplication}>Be part of it <ArrowRight size={15} /></button></section>
    </main>
    <footer className="site-footer" id="connect"><Brand className="footer-wordmark" href="#top" /><span className="footer-tagline">CREDIBILITY THAT CROSSES BORDERS.</span><span className="footer-copy">© 2026 BUSINESS HUB AFRICA</span></footer>
  </div>
}

export default App
