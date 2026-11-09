import { useEffect, useState, type CSSProperties } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ChevronDown, Compass, Globe2, MapPin, Menu, Moon, Search, Share2, ShieldCheck, Sparkles, Sun, X } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient, hasSupabaseConfig, publicMediaUrl, type BusinessListing } from './supabase'
import { Brand } from './Brand'
import { BusinessWebsite } from './components/BusinessWebsite'
import { normaliseHours, normaliseSocials } from './lib/website'
import { AdminDashboard, BusinessDashboard } from './Dashboards'
import { AuthScreen } from './Auth'
import { CategoryPage } from './pages/CategoryPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LandingPageEditor } from './pages/LandingPageEditor'
import { generateBusinessStructuredData } from './lib/seo'
import { type PageContent, type PageVersion } from './lib/pages'
import './bha.css'

type SubscriptionPlan = {
  id: string
  name: string
  standard_price: number
  currency: string
  booking_enabled: boolean
  features: string[]
}

function primaryCategory(business: BusinessListing) {
  return business.business_categories?.find((item) => item.is_primary)?.categories || null
}

function countryName(business: BusinessListing) {
  return business.country?.name || business.country_code || ''
}

function businessTypeName(business: BusinessListing) {
  return business.business_type?.name || ''
}

function BusinessPage({ slug, session }: { slug: string; session: Session | null }) {
  const [business, setBusiness] = useState<any>(null)
  const [pageVersion, setPageVersion] = useState<PageVersion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [media, setMedia] = useState<any[]>([])
  const [copied, setCopied] = useState(false)
  const previewVersion = new URLSearchParams(window.location.search).get('preview')

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsLoading(false)
      setNotFound(true)
      return
    }
    let isCurrent = true
    const load = async () => {
      setIsLoading(true)
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('businesses')
        .select('*, business_profiles(*), business_services(name, description), business_socials(platform, url), business_categories(is_primary, categories(name), subcategories(name)), business_type_vocabulary(name)')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle()
      if (!isCurrent) return
      if (error || !data) {
        setBusiness(null)
        setNotFound(true)
        setIsLoading(false)
        return
      }
      setBusiness(data)

      const { data: mediaData } = await client
        .from('business_media')
        .select('*')
        .eq('business_id', data.id)
        .order('created_at', { ascending: true })
      if (isCurrent && mediaData) setMedia(mediaData)

      let versionQuery = client.from('page_versions').select('*').eq('business_id', data.id)
      if (previewVersion) versionQuery = versionQuery.eq('version', Number(previewVersion))
      else versionQuery = versionQuery.eq('status', 'PUBLISHED')
      const { data: version } = await versionQuery.order('version', { ascending: false }).limit(1).maybeSingle()
      if (!isCurrent) return
      setPageVersion((version || null) as PageVersion | null)
      setIsLoading(false)
    }
    void load()
    return () => { isCurrent = false }
  }, [previewVersion, session?.user.id, slug])

  useEffect(() => {
    if (!business) return
    const content: PageContent = pageVersion?.content || {}
    document.title = content.seo_title || `${business.business_name} | Business Hub Africa`
    const description = content.seo_description || business.short_description || ''
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)
  }, [business, pageVersion])

  // Inject structured data
  useEffect(() => {
    if (!business) return
    const content: PageContent = pageVersion?.content || {}
    const schema = generateBusinessStructuredData({
      name: content.page_headline || business.business_name,
      description: content.seo_description || business.short_description,
      url: `${window.location.origin}/business/${business.slug}`,
      image: content.hero_image_url || business.cover_image_url,
      city: business.city,
      country: business.country?.name || business.country_code || '',
      phone: business.phone ?? null,
      email: business.email ?? null,
      website: business.website ?? null,
      category: business.business_categories?.find((item: any) => item.is_primary)?.categories?.name || '',
      businessType: business.business_type_vocabulary?.name || '',
      verified: business.is_verified,
      services: content.suggested_services || business.business_services || [],
      datePublished: null,
    })
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = schema
    document.head.appendChild(script)
    return () => { document.head.removeChild(script) }
  }, [business, pageVersion])

  if (isLoading) return <main className="profile-state" role="status">Loading business profile…</main>
  if (!business || notFound) return <main className="profile-state"><h1>This business page isn't available.</h1><a href="/">Back to discovery <ArrowRight size={15} /></a></main>

  const content: PageContent = pageVersion?.content || {}
  const profile = Array.isArray(business.business_profiles) ? business.business_profiles[0] : business.business_profiles
  const countryName = business.country?.name || business.country_code
  const categoryName = business.business_categories?.find((item: any) => item.is_primary)?.categories?.name || ''
  const subcategoryName = business.business_categories?.find((item: any) => item.is_primary)?.subcategories?.name || ''
  const typeName = business.business_type_vocabulary?.name || ''
  const headline = content.page_headline || business.business_name
  const intro = content.page_intro || business.short_description
  const about = content.about_section || profile?.description || business.short_description
  const services = content.suggested_services?.length ? content.suggested_services : (business.business_services || [])
  const facts = (content.key_facts || []).map((fact) => typeof fact === 'string' ? { label: 'Fact', value: fact } : fact).filter((fact) => fact.value)
  const features = (content.features || []).filter((feature) => feature.title)
  const processSteps = (content.process_steps || []).filter((step) => step.title)
  const faq = (content.faq || []).filter((item) => item.question && item.answer)
  const heroHighlights = (content.hero_highlights || []).filter((highlight): highlight is string => typeof highlight === 'string' && Boolean(highlight.trim()))
  const isPreview = Boolean(previewVersion)
  const brandColor = /^#[0-9a-f]{6}$/i.test(String(content.brand_color || ''))
    ? String(content.brand_color)
    : (profile?.brand_color || '#092d67')
  const logoUrl = content.logo_url || business.logo_url || ''
  const aboutImage = typeof content.about_image_url === 'string' ? content.about_image_url : ''
  const contentGallery = Array.isArray(content.gallery_images)
    ? content.gallery_images.filter((image) => Boolean(image?.url))
    : []
  const galleryImages = contentGallery.length > 0
    ? contentGallery
    : media.map((item: any) => ({
        url: publicMediaUrl(item.url || item.storage_path || ''),
        alt: item.alt_text || business.business_name,
        caption: item.caption,
      })).filter((image) => Boolean(image.url))
  const pageUrl = typeof window !== 'undefined' ? `${window.location.origin}/business/${business.slug}` : `/business/${business.slug}`
  const socials = business.business_socials?.length
    ? normaliseSocials(business.business_socials)
    : normaliseSocials(profile?.social_links)
  const websiteBusiness = {
    name: business.business_name,
    headline,
    tagline: content.hero_tagline || intro,
    intro,
    about,
    aboutTitle: content.about_title || '',
    logoUrl,
    heroImage: content.hero_image_url || business.cover_image_url || '',
    aboutImage,
    gallery: galleryImages,
    brandColor,
    category: categoryName,
    subcategory: subcategoryName,
    businessType: typeName,
    city: business.city,
    country: countryName,
    verified: Boolean(business.is_verified),
    ctaText: content.cta_text || '',
    heroEyebrow: content.hero_eyebrow || '',
    heroHighlights,
    facts,
    services,
    features,
    processSteps,
    faq,
    customSections: Array.isArray(content.sections)
      ? content.sections.filter((section) => !['about', 'services', 'cta'].includes(String(section?.id)))
      : [],
    contactHeading: content.contact_heading || '',
    contactNote: content.contact_note || '',
    footerNote: content.footer_note || '',
  }
  const websiteContact = {
    email: business.email || '',
    phone: business.phone || '',
    whatsapp: profile?.whatsapp || '',
    website: business.website || '',
    address: profile?.address || '',
    hours: normaliseHours(profile?.opening_hours),
    socials,
  }

  const sharePage = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: headline, text: intro || business.short_description || '', url: pageUrl })
        return
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return <div className="biz-public" style={{ '--brand-color': brandColor } as CSSProperties}>
    <header className="biz-public-bar">
      <Brand href="/" />
      <div className="biz-public-bar-actions">
        <span className="biz-public-bar-context">{categoryName || 'Business'} · Business Hub Africa</span>
        <button type="button" className="share-button" onClick={() => void sharePage()}>{copied ? <><Check size={15} /> Copied link</> : <><Share2 size={15} /> Share page</>}</button>
        <a className="profile-back" href="/"><ArrowLeft size={15} /> Back to discovery</a>
      </div>
    </header>
    {isPreview && <div className="preview-banner"><Sparkles size={15} /> Previewing version {pageVersion?.version ?? 'draft'} · {String(business.status || '').replaceAll('_', ' ')} <a href="/dashboard/page">Back to editor <ArrowRight size={13} /></a></div>}
    <BusinessWebsite business={websiteBusiness} contact={websiteContact} idPrefix={`business-${business.slug}`} />
  </div>
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('bha-theme') === 'dark' ? 'dark' : 'light')
  const [businesses, setBusinesses] = useState<BusinessListing[]>([])
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('All countries')
  const [industry, setIndustry] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [industryOptions, setIndustryOptions] = useState<string[]>([])
  const [countryOptions, setCountryOptions] = useState<string[]>(['All countries'])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [promotionPercent, setPromotionPercent] = useState(0)
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
    if (!hasSupabaseConfig) {
      setIsLoading(false)
      return
    }
    let isCurrent = true
    const loadBusinesses = async () => {
      setIsLoading(true)
      const { data, error } = await getSupabaseClient()
        .from('businesses')
        .select('id, slug, business_name, short_description, country_code, country:countries(name), city, cover_image_url, is_verified, is_booking_enabled, phone, email, website, services:business_services(name, description), business_categories(is_primary, categories(name, slug)), business_type:business_type_vocabulary(name)')
        .eq('status', 'LIVE')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(200)
      if (!isCurrent) return
      setBusinesses(error ? [] : (data as unknown as BusinessListing[]))
      setIsLoading(false)
    }
    void loadBusinesses()
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    const names = industry
      ? businesses
          .filter((business) => primaryCategory(business)?.name === industry)
          .map((business) => businessTypeName(business))
          .filter(Boolean)
      : []
    setTypes(Array.from(new Set(names)).sort())
  }, [businesses, industry])

  const visibleBusinesses = businesses.filter((business) => {
    const normalizedQuery = query.trim().toLowerCase()
    const category = primaryCategory(business)?.name || ''
    const type = businessTypeName(business)
    const place = countryName(business)
    const matchesQuery = !normalizedQuery || `${business.business_name} ${business.short_description} ${business.city} ${place} ${category} ${type}`.toLowerCase().includes(normalizedQuery)
    return matchesQuery
      && (country === 'All countries' || place === country)
      && (!industry || category === industry)
      && (!businessType || type === businessType)
  })

  const changeIndustry = (value: string) => {
    setIndustry(value)
    setBusinessType('')
  }
  const clearFilters = () => { setQuery(''); setCountry('All countries'); changeIndustry('') }
  const startApplication = () => window.location.assign(session ? '/dashboard' : '/signup')
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
  if (routeSlug) return <BusinessPage slug={routeSlug} session={session} />
  if (window.location.pathname === '/dashboard/page') {
    if (isAuthLoading) return <main className="profile-state" role="status">Checking your account…</main>
    if (!session) return <AuthScreen mode="login" />
    return <LandingPageEditor session={session} />
  }
  if (window.location.pathname === '/dashboard') {
    if (isAuthLoading) return <main className="profile-state" role="status">Checking your account…</main>
    if (!session) return <AuthScreen mode="login" />
    return <BusinessDashboard theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} session={session} />
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
    if (!session) return <AuthScreen mode="login" />
    return <AdminDashboard theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} session={session} />
  }

  return <div className="site-shell">
    <div className="announcement-bar"><span className="announcement-dot" /> AFRICAN BUSINESSES, OPEN TO THE WORLD <span className="announcement-divider">/</span> <a href="#how-it-works">OUR APPROACH <ArrowRight size={12} /></a><span className="announcement-right">A NEW KIND OF BUSINESS PRESENCE <ArrowDownRight size={14} /></span></div>
    <header className="site-header"><Brand href="#top" label="Business Hub Africa home" /><button className="mobile-menu-button" type="button" aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X size={21} /> : <Menu size={21} />}</button><nav className={`main-nav ${isMenuOpen ? 'is-open' : ''}`} aria-label="Main navigation"><a href="#discover" onClick={() => setIsMenuOpen(false)}>Discover businesses</a><a href="#how-it-works" onClick={() => setIsMenuOpen(false)}>How it works</a><a href="#plans" onClick={() => setIsMenuOpen(false)}>For businesses</a><a href="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</a><a href="/admin" onClick={() => setIsMenuOpen(false)}>Admin</a><a href="/login" onClick={() => setIsMenuOpen(false)}>Sign in</a><button className="theme-toggle public-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="nav-cta" type="button" onClick={startApplication}>Get your business online <ArrowRight size={15} /></button></nav></header>

    <main id="top">
      <section className="hero-section" aria-labelledby="hero-title"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> CREDIBILITY AND VISIBILITY</div><h1 id="hero-title">Discover trusted African businesses <em>and services.</em></h1><ul className="hero-trust"><li>Verified</li><li>Compliance-Ready</li><li>Export-Ready</li></ul><div className="hero-bottomline"><p>Businesses across Africa!</p><a className="text-link" href="#discover">Explore the network <ArrowRight size={15} /></a></div><div className="hero-stamp"><Globe2 size={15} /><span>54 COUNTRIES<br /><b>ONE CONTINENT</b></span></div></div><div className="hero-image-wrap"><img className="hero-image" src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=90" alt="Modern African city skyline seen through architectural glass" /><div className="hero-image-shade" /><div className="hero-image-caption"><span className="caption-index">01 / 54</span><span>BUSINESS IS MOVING.<br /><b>BE THERE TO MEET IT.</b></span><ArrowDownRight size={19} /></div><div className="hero-image-label"><span className="live-dot" /> BUILT FOR BUSINESS ACROSS AFRICA</div></div></section>

      <section className="proof-strip" aria-label="Business Hub Africa benefits"><div className="proof-item"><span className="proof-icon"><ShieldCheck size={18} /></span><div><b>Identity, verified</b><span>Trust starts with knowing</span></div></div><span className="proof-separator" /><div className="proof-item"><span className="proof-icon"><Building2 size={18} /></span><div><b>A page of your own</b><span>Your business, presented well</span></div></div><span className="proof-separator" /><div className="proof-item"><span className="proof-icon"><Compass size={18} /></span><div><b>Found beyond borders</b><span>Visibility that travels</span></div></div><span className="proof-note">GET VERIFIED. GET ONLINE. GET DISCOVERED.</span></section>

      <section className="discovery-section" id="discover" aria-labelledby="discover-title"><div className="section-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> THE BHA BUSINESS NETWORK</div><h2 id="discover-title">Find your next <em>good business.</em></h2></div><p>Explore credible businesses building across the continent. Start with a place, an industry, or a name.</p></div>
        {!hasSupabaseConfig && <div className="preview-notice"><Sparkles size={15} /><span>Not connected</span><span>Add your Supabase project credentials to display live businesses.</span><a href="#connect">Setup details <ArrowRight size={13} /></a></div>}
        <div className="search-panel" role="search"><label className="keyword-field"><Search size={19} /><span className="sr-only">Search businesses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, service, or keyword" /></label><label className="select-field"><MapPin size={17} /><span className="sr-only">Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}>{countryOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><label className="select-field"><Building2 size={17} /><span className="sr-only">Industry</span><select value={industry} onChange={(event) => changeIndustry(event.target.value)}><option value="">All industries</option>{industryOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><label className="select-field type-select"><span className="sr-only">Business type</span><select value={businessType} disabled={!industry || types.length === 0} onChange={(event) => setBusinessType(event.target.value)}><option value="">{industry ? 'All business types' : 'Choose industry first'}</option>{types.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="select-chevron" size={14} /></label><button className="search-button" type="button" onClick={() => document.getElementById('business-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Explore <ArrowRight size={16} /></button></div>
        <div className="results-toolbar"><div className="results-count"><span className="results-count-number">{isLoading ? '—' : visibleBusinesses.length}</span><span>BUSINESSES<br />TO GET TO KNOW</span></div><div className="results-controls"><span className="results-location"><MapPin size={14} /> {country === 'All countries' ? 'Across Africa' : country}</span><span className="sort-divider" /><button className="sort-button" type="button" onClick={clearFilters}>Clear filters <X size={14} /></button></div></div>
        {visibleBusinesses.length > 0 ? <div className="business-grid" id="business-grid">{visibleBusinesses.map((business, index) => { const category = primaryCategory(business); const type = businessTypeName(business); return <article className="business-card" key={business.id} style={{ animationDelay: `${index * 70}ms` }}><a className="business-image-link" href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}><img className="business-image" src={business.cover_image_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=85'} alt={`${business.business_name} business profile`} loading="lazy" />{business.is_verified && <span className="verified-pill"><BadgeCheck size={13} /> BHA VERIFIED</span>}{business.is_booking_enabled && <span className="booking-pill">BOOKABLE</span>}</a><div className="business-card-body"><div className="business-card-meta">{category && <a href={`/category/${category.slug}`} className="card-category-link">{category.name}</a>}{type && <><span className="meta-dot" /><span>{type}</span></>}</div><h3><a href={`/business/${business.slug}`}>{business.business_name}</a></h3><p>{business.short_description}</p><div className="business-card-footer"><span><MapPin size={13} /> {business.city}, {countryName(business)}</span><a href={`/business/${business.slug}`} aria-label={`View ${business.business_name}`}><ArrowRight size={17} /></a></div></div></article>})}</div> : isLoading ? <div className="empty-state" role="status">Loading the business network…</div> : <div className="empty-state"><Search size={24} /><h3>No businesses found just yet</h3><p>Try a different keyword or clear a filter to explore more of the network.</p><button type="button" onClick={clearFilters}>Clear all filters <ArrowRight size={14} /></button></div>}
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
