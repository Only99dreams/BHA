import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, BadgeCheck, Bell, Building2, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, FileText, Filter, Globe2, LayoutDashboard, LogOut, Menu, MoreHorizontal, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { Brand } from './Brand'
import { TaxonomyManager } from './admin/TaxonomyManager'
import { QualityReviewPanel } from './admin/QualityReviewPanel'
import { AnalyticsDashboard } from './admin/AnalyticsDashboard'
import { TaxonomyFeedbackPanel } from './admin/TaxonomyFeedbackPanel'
import { getSupabaseClient } from './supabase'
import { buildDraftContent, ensureReviewStatus, invokeGeneratePage, savePageVersion, type PageContent, type PageVersion } from './lib/pages'
import './dashboards.css'

type Theme = 'light' | 'dark'
type ThemeProps = { theme: Theme; onToggleTheme: () => void }
type Props = ThemeProps & { onSignOut: () => Promise<void>; session: Session }

function displayName(session: Session) {
  const metadata = session.user.user_metadata as Record<string, unknown> | undefined
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : ''
  return fullName || session.user.email?.split('@')[0] || 'Business owner'
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'BHA'
}

function statusTone(status: string) {
  if (status === 'LIVE') return 'verified'
  if (status === 'QUALITY_REVIEW') return 'review'
  if (status === 'APPROVED') return 'active'
  if (status === 'AI_PAGE_GENERATING') return 'generating'
  if (status === 'VERIFICATION_PENDING') return 'verification'
  return 'information'
}

function humanise(status: string) {
  return status.replaceAll('_', ' ')
}

function ThemeToggle({ theme, onToggleTheme }: ThemeProps) {
  const next = theme === 'light' ? 'dark' : 'light'
  return <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}>{next === 'dark' ? '◐' : '☼'}</button>
}

function Sidebar({
  active,
  close,
  onSignOut,
  workspaceName,
  workspaceSubtitle,
  workspaceInitials,
  showAdmin,
}: {
  active: string
  close: () => void
  onSignOut: () => Promise<void>
  workspaceName: string
  workspaceSubtitle: string
  workspaceInitials: string
  showAdmin: boolean
}) {
  return <aside className="dash-sidebar">
    <Brand className="sidebar-brand" href="/" />
    <div className="sidebar-workspace"><span className="workspace-avatar">{workspaceInitials}</span><span><b>{workspaceName}</b><small>{workspaceSubtitle}</small></span><ChevronDown size={14} /></div>
    <span className="sidebar-label">WORKSPACE</span>
    <nav className="sidebar-nav" aria-label="Dashboard navigation">
      <a className={active === 'overview' ? 'active' : ''} href="/dashboard"><LayoutDashboard size={17} /> Overview</a>
      <a className={active === 'business' ? 'active' : ''} href="/dashboard#business"><Building2 size={17} /> My business</a>
      <a className={active === 'page' ? 'active' : ''} href="/dashboard/page"><FileText size={17} /> Landing page</a>
      <a href="/dashboard#subscription"><CircleDollarSign size={17} /> Subscription</a>
      <a href="/dashboard#activity"><CalendarDays size={17} /> Activity</a>
    </nav>
    {showAdmin && <>
      <span className="sidebar-label admin-label">ADMINISTRATION</span>
      <nav className="sidebar-nav"><a className={active === 'admin' ? 'active' : ''} href="/admin"><ShieldCheck size={17} /> Admin dashboard</a><a href="/admin#taxonomy"><Settings size={17} /> Taxonomy</a></nav>
    </>}
    <div className="sidebar-bottom"><div className="support-card"><Sparkles size={15} /><b>Need a hand?</b><span>Your BHA team is here to help.</span><a href="mailto:support@businesshub.africa">Contact support <ArrowRight size={13} /></a></div><button className="sidebar-logout" type="button" onClick={() => void onSignOut()}><LogOut size={16} /> Sign out</button></div>
    <button className="sidebar-dismiss" type="button" aria-label="Close menu" onClick={close}><X size={19} /></button>
  </aside>
}

function Header({ title, theme, onToggleTheme, onMenu, userInitials }: ThemeProps & { title: string; onMenu: () => void; userInitials: string }) {
  return <header className="dash-topbar"><button className="mobile-dash-menu" type="button" onClick={onMenu} aria-label="Open dashboard menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Business Hub Africa</span><span>/</span><b>{title}</b></div><div className="topbar-actions"><button className="icon-action" type="button" aria-label="Notifications"><Bell size={17} /><i /></button><ThemeToggle theme={theme} onToggleTheme={onToggleTheme} /><span className="topbar-avatar">{userInitials}</span></div></header>
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`status-badge status-${tone}`}><i />{children}</span>
}

function Layout({
  active,
  title,
  theme,
  onToggleTheme,
  onSignOut,
  session,
  workspaceName,
  workspaceSubtitle,
  showAdmin,
  children,
}: Props & { active: string; title: string; workspaceName: string; workspaceSubtitle: string; showAdmin?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const userName = displayName(session)
  return <div className={`dashboard-shell ${open ? 'sidebar-open' : ''}`}>
    <Sidebar active={active} close={() => setOpen(false)} onSignOut={onSignOut} workspaceName={workspaceName} workspaceSubtitle={workspaceSubtitle} workspaceInitials={initials(workspaceName)} showAdmin={Boolean(showAdmin)} />
    {open && <button className="sidebar-scrim" type="button" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <div className="dash-main"><Header title={title} theme={theme} onToggleTheme={onToggleTheme} onMenu={() => setOpen(true)} userInitials={initials(userName)} />{children}</div>
  </div>
}

type OwnerBusiness = {
  id: string
  slug: string
  business_name: string
  short_description: string
  city: string
  country_code: string
  status: string
  is_published: boolean
  publication_status: string
  primary_category_id: string | null
  email: string | null
  phone: string | null
  cover_image_url: string | null
  created_at: string
  business_profiles?: { description?: string; region?: string; opening_hours?: Record<string, unknown> } | { description?: string; region?: string; opening_hours?: Record<string, unknown> }[] | null
  business_categories?: { is_primary: boolean; categories?: { name?: string } | null; subcategories?: { name?: string } | null }[]
  business_type_vocabulary?: { name?: string } | null
  business_services?: { id: string; name: string; description: string }[]
  business_socials?: { platform: string; url: string }[]
}

type SubscriptionRow = {
  status: string
  starts_at: string | null
  ends_at: string | null
  subscription_plans?: { name?: string; standard_price?: number; currency?: string; booking_enabled?: boolean } | { name?: string; standard_price?: number; currency?: string; booking_enabled?: boolean }[] | null
}

function profileValue(business: OwnerBusiness, key: 'description' | 'region') {
  const profile = business.business_profiles
  const row = Array.isArray(profile) ? profile[0] : profile
  return row?.[key] || ''
}

function categoryName(business: OwnerBusiness) {
  return business.business_categories?.find((item) => item.is_primary)?.categories?.name || ''
}

function pageContent(version: PageVersion | undefined): PageContent {
  return version?.content || {}
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatMoney(plan: SubscriptionRow['subscription_plans']) {
  const row = Array.isArray(plan) ? plan[0] : plan
  if (!row) return ''
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: row.currency || 'USD', maximumFractionDigits: 0 }).format(Number(row.standard_price || 0))
}

export function BusinessDashboard({ theme, onToggleTheme, onSignOut, session }: Props) {
  const [business, setBusiness] = useState<OwnerBusiness | null>(null)
  const [versions, setVersions] = useState<PageVersion[]>([])
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null)
  const [enquiryCount, setEnquiryCount] = useState(0)
  const [bookingCount, setBookingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    const client = getSupabaseClient()
    const { data, error: businessError } = await client
      .from('businesses')
      .select('*, business_profiles(*), business_categories(is_primary, categories(name), subcategories(name)), business_type_vocabulary(name), business_services(id, name, description), business_socials(platform, url)')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (businessError) {
      setError(businessError.message)
      setLoading(false)
      return
    }

    const owned = data as OwnerBusiness | null
    setBusiness(owned)
    if (!owned) {
      setVersions([])
      setSubscription(null)
      setEnquiryCount(0)
      setBookingCount(0)
      setLoading(false)
      return
    }

    const [versionResult, subscriptionResult, enquiryResult, bookingResult] = await Promise.all([
      client.from('page_versions').select('*').eq('business_id', owned.id).order('version', { ascending: false }),
      client.from('subscriptions').select('status, starts_at, ends_at, subscription_plans(name, standard_price, currency, booking_enabled)').eq('business_id', owned.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      client.from('enquiries').select('*', { count: 'exact', head: true }).eq('business_id', owned.id),
      client.from('bookings').select('*', { count: 'exact', head: true }).eq('business_id', owned.id),
    ])

    setVersions((versionResult.data || []) as PageVersion[])
    setSubscription((subscriptionResult.data || null) as SubscriptionRow | null)
    setEnquiryCount(enquiryResult.count || 0)
    setBookingCount(bookingResult.count || 0)
    setLoading(false)
  }, [session.user.id])

  useEffect(() => { void load() }, [load])

  const generatePage = async () => {
    if (!business) return
    setGenerating(true)
    setError('')
    setNotice('')
    const client = getSupabaseClient()
    try {
      const { data: current } = await client.from('businesses').select('status').eq('id', business.id).maybeSingle()
      if (current?.status === 'INFORMATION_PENDING') {
        await client.from('businesses').update({ status: 'INFORMATION_RECEIVED' }).eq('id', business.id)
      }
      if (current?.status === 'INFORMATION_PENDING' || current?.status === 'INFORMATION_RECEIVED') {
        await client.from('businesses').update({ status: 'AI_PAGE_GENERATING' }).eq('id', business.id)
      }

      try {
        await invokeGeneratePage(client, business.id)
        setNotice('A fresh landing page draft has been generated.')
      } catch (generationError) {
        console.error('AI generation failed, creating a local draft:', generationError)
        const content = buildDraftContent({
          businessName: business.business_name,
          shortDescription: business.short_description,
          description: profileValue(business, 'description'),
          services: business.business_services || [],
          city: business.city,
          country: business.country_code,
          categoryName: categoryName(business),
          businessTypeName: business.business_type_vocabulary?.name,
          coverImageUrl: business.cover_image_url,
        })
        const saved = await savePageVersion(client, { businessId: business.id, content, status: 'DRAFT' })
        if (saved.error) throw saved.error
        await ensureReviewStatus(client, business.id)
        setNotice('AI generation is not available right now, so a draft has been created from your business details.')
      }
      await load()
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate the landing page.')
    } finally {
      setGenerating(false)
    }
  }

  const userName = displayName(session)
  const firstName = userName.split(/\s+/)[0] || userName
  const today = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  if (loading) {
    return <Layout active="overview" title="Business dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut} session={session} workspaceName="Your workspace" workspaceSubtitle="Business Hub Africa">
      <main className="dash-content"><div className="profile-state" role="status">Loading your business…</div></main>
    </Layout>
  }

  if (!business) {
    return <Layout active="overview" title="Business dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut} session={session} workspaceName={`${firstName}'s workspace`} workspaceSubtitle="Business Hub Africa">
      <main className="dash-content">
        <div className="dash-page-heading"><div><div className="page-kicker">{today.toUpperCase()} <i /> BUSINESS OWNER</div><h1>Welcome, {firstName}</h1><p>Your account is ready. Add your business to create a landing page.</p></div></div>
        {error && <div className="onboarding-error">{error}</div>}
        <section className="dashboard-panel onboarding-empty-state">
          <span className="welcome-mark"><Building2 size={23} /></span>
          <h2>Tell us about your business</h2>
          <p>Share your identity, location, contact details, services and media. We will create a professional landing page draft you can review and edit.</p>
          <div className="empty-state-actions">
            <a className="primary-button" href="/onboarding">Start business onboarding <ArrowRight size={15} /></a>
          </div>
        </section>
      </main>
    </Layout>
  }

  const latestVersion = versions[0]
  const editableVersion = versions.find((version) => version.status === 'DRAFT' || version.status === 'IN_REVIEW') || latestVersion
  const latestContent = pageContent(editableVersion)
  const services = business.business_services || []
  const completenessChecks = [
    Boolean(business.business_name),
    Boolean(business.short_description),
    Boolean(profileValue(business, 'description')),
    Boolean(business.primary_category_id),
    services.length > 0,
    Boolean(business.email || business.phone),
    Boolean(business.cover_image_url),
  ]
  const completeness = Math.round((completenessChecks.filter(Boolean).length / completenessChecks.length) * 100)
  const journey = [
    { label: 'Business details', state: completeness === 100 ? 'Complete' : `${completeness}% complete`, done: completeness === 100 },
    { label: 'Landing page draft', state: versions.length > 0 ? `Version ${editableVersion?.version || 1} · ${humanise(editableVersion?.status || 'DRAFT')}` : 'Not created yet', done: versions.length > 0 },
    { label: 'BHA review', state: business.status === 'QUALITY_REVIEW' ? 'In review' : business.status === 'APPROVED' || business.status === 'LIVE' ? 'Approved' : 'Starts after you submit', done: business.status === 'APPROVED' || business.status === 'LIVE' },
    { label: 'Public business page', state: business.is_published && business.status === 'LIVE' ? 'Published' : 'Not published', done: business.is_published && business.status === 'LIVE' },
  ]

  return <Layout active="overview" title="Business dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut} session={session} workspaceName={business.business_name} workspaceSubtitle="Business Hub Africa">
    <main className="dash-content">
      <div className="dash-page-heading"><div><div className="page-kicker">{today.toUpperCase()} <i /> BUSINESS OWNER</div><h1>Good morning, {firstName}</h1><p>Here is what is happening with {business.business_name}.</p></div><a className="secondary-button" href="/onboarding?edit=1"><Settings size={16} /> Edit details</a></div>

      {error && <div className="onboarding-error">{error}</div>}
      {notice && <div className="onboarding-success">{notice}</div>}

      <section className="welcome-banner" id="business">
        <span className="welcome-mark"><Building2 size={23} /></span>
        <div className="welcome-copy">
          <div className="welcome-line"><h2>{business.business_name}</h2><Badge tone={statusTone(business.status)}>{humanise(business.status)}</Badge></div>
          <p>{categoryName(business) || business.business_type_vocabulary?.name || 'Business'} <i /> {business.city}, {business.country_code}</p>
          <span>{business.short_description || 'Add a short description so visitors know what you do.'}</span>
        </div>
        <div className="welcome-actions">
          <a className="outline-button" href={`/business/${business.slug}${editableVersion ? `?preview=${editableVersion.version}` : ''}`} target="_blank" rel="noreferrer">Preview page <ArrowRight size={14} /></a>
          <a className="primary-button" href="/dashboard/page">Edit landing page <ArrowRight size={14} /></a>
        </div>
      </section>

      <section className="metric-grid owner-metrics">
        <article className="metric-card"><span className="metric-heading">PROFILE COMPLETION <MoreHorizontal size={16} /></span><strong>{completeness}<span>%</span></strong><div className="meter"><i style={{ width: `${completeness}%` }} /></div><small>{completenessChecks.filter(Boolean).length} of {completenessChecks.length} sections complete</small></article>
        <article className="metric-card"><span className="metric-heading">LANDING PAGE <FileText size={15} /></span><strong className="metric-plan">{editableVersion ? `v${editableVersion.version}` : 'None'}</strong><small>{editableVersion ? humanise(editableVersion.status) : 'Create your first draft'}</small><a className="metric-link" href="/dashboard/page">{editableVersion ? 'Open editor' : 'Create page'} <ArrowRight size={13} /></a></article>
        <article className="metric-card"><span className="metric-heading">ENQUIRIES <Activity size={15} /></span><strong>{enquiryCount}</strong><small>{bookingCount} booking {bookingCount === 1 ? 'request' : 'requests'}</small><a className="metric-link" href="/dashboard#activity">View activity <ArrowRight size={13} /></a></article>
        <article className="metric-card"><span className="metric-heading">SUBSCRIPTION <CircleDollarSign size={15} /></span><strong className="metric-plan">{subscription ? humanise(subscription.status) : 'No plan'}</strong><small>{subscription ? `Renews ${formatDate(subscription.ends_at)}` : 'Choose a plan to go live'}</small><a className="metric-link" href="/#plan-prices">{subscription ? 'Manage plan' : 'View plans'} <ArrowRight size={13} /></a></article>
      </section>

      <section className="dashboard-columns">
        <article className="dashboard-panel journey-panel">
          <div className="panel-heading"><div><span className="panel-eyebrow">YOUR BHA JOURNEY</span><h2>On the way to go-live</h2></div><a href="/dashboard/page">View page <ArrowRight size={14} /></a></div>
          <div className="journey-list">{journey.map((step, index) => {
            const currentIndex = journey.findIndex((item) => !item.done)
            return <div className={`journey-step ${step.done ? 'is-complete' : index === currentIndex ? 'is-current' : ''}`} key={step.label}>
              <span className="journey-indicator">{step.done ? <Check size={13} /> : String(index + 1).padStart(2, '0')}</span>
              <div><b>{step.label}</b><span>{step.state}</span></div>
              {index === currentIndex && <a className="step-action" href={index === 0 ? '/onboarding?edit=1' : index === 1 ? '/dashboard/page' : '/dashboard/page'}>Continue <ArrowRight size={13} /></a>}
            </div>
          })}</div>
          <div className="journey-footer"><span><Clock3 size={14} /> Your page stays private until BHA approves it.</span><b>{journey.filter((step) => step.done).length} / {journey.length}</b></div>
        </article>

        <article className="dashboard-panel page-panel" id="page">
          <div className="panel-heading"><div><span className="panel-eyebrow">LANDING PAGE</span><h2>{editableVersion ? `Version ${editableVersion.version}` : 'No page yet'}</h2></div>{editableVersion && <Badge tone={statusTone(editableVersion.status === 'PUBLISHED' ? 'LIVE' : 'QUALITY_REVIEW')}>{humanise(editableVersion.status)}</Badge>}</div>
          {editableVersion ? <>
            <div className="landing-preview">
              <strong>{latestContent.page_headline || business.business_name}</strong>
              <p>{latestContent.page_intro || business.short_description}</p>
              <small>{(latestContent.about_section || profileValue(business, 'description') || 'No about section yet.').slice(0, 220)}{(latestContent.about_section || '').length > 220 ? '…' : ''}</small>
            </div>
            <div className="panel-actions">
              <a className="primary-button" href="/dashboard/page">Edit page <ArrowRight size={14} /></a>
              <a className="secondary-button" href={`/business/${business.slug}?preview=${editableVersion.version}`} target="_blank" rel="noreferrer">Preview <ArrowRight size={14} /></a>
            </div>
          </> : <>
            <p className="page-editor-hint">Generate a landing page from your business details, or write one yourself.</p>
            <div className="panel-actions">
              <button className="primary-button" type="button" onClick={() => void generatePage()} disabled={generating}>{generating ? 'Generating…' : 'Generate with AI'} <Sparkles size={14} /></button>
              <a className="secondary-button" href="/dashboard/page">Write manually <ArrowRight size={14} /></a>
            </div>
          </>}
        </article>
      </section>

      <section className="dashboard-columns">
        <article className="dashboard-panel plan-panel" id="subscription">
          <div className="panel-heading"><div><span className="panel-eyebrow">YOUR SUBSCRIPTION</span><h2>{subscription ? (Array.isArray(subscription.subscription_plans) ? subscription.subscription_plans[0]?.name : subscription.subscription_plans?.name) || 'Plan' : 'No active plan'}</h2></div>{subscription && <Badge tone={subscription.status === 'ACTIVE' ? 'active' : 'review'}>{humanise(subscription.status)}</Badge>}</div>
          {subscription ? <>
            <div className="plan-amount"><strong>{formatMoney(subscription.subscription_plans)}</strong><span>per year</span></div>
            <div className="plan-detail"><span>Started {formatDate(subscription.starts_at)}</span><span>Next payment <b>{formatDate(subscription.ends_at)}</b></span></div>
            <a className="panel-action" href="/#plan-prices">Manage subscription <ArrowRight size={14} /></a>
          </> : <>
            <p className="page-editor-hint">A plan activates your public presence and booking tools when you are ready.</p>
            <a className="panel-action" href="/#plan-prices">Choose a plan <ArrowRight size={14} /></a>
          </>}
        </article>

        <article className="dashboard-panel activity-panel" id="activity">
          <div className="panel-heading"><div><span className="panel-eyebrow">RECENT ACTIVITY</span><h2>Keep things moving</h2></div></div>
          <div className="activity-list">
            <article><span className="activity-icon activity-blue"><FileText size={16} /></span><div><b>Landing page draft</b><span>{editableVersion ? `Version ${editableVersion.version} is ${humanise(editableVersion.status).toLowerCase()}.` : 'No page has been created yet.'}</span></div><span className="activity-time">{editableVersion ? formatDate(editableVersion.created_at) : '—'}</span></article>
            <article><span className="activity-icon activity-green"><CalendarDays size={16} /></span><div><b>Booking requests</b><span>{bookingCount} booking {bookingCount === 1 ? 'request' : 'requests'} so far.</span></div><span className="activity-time">TOTAL</span></article>
            <article><span className="activity-icon activity-orange"><Users size={16} /></span><div><b>Customer enquiries</b><span>{enquiryCount} {enquiryCount === 1 ? 'enquiry' : 'enquiries'} received.</span></div><span className="activity-time">TOTAL</span></article>
          </div>
        </article>
      </section>

      <div className="dashboard-footnote"><ShieldCheck size={14} /> Your business details are visible only to you and the BHA review team until approved.</div>
    </main>
  </Layout>
}

type AdminStats = {
  total: number
  live: number
  review: number
  verified: number
  verificationPending: number
  paymentPending: number
  informationPending: number
  aiGenerating: number
}

const emptyStats: AdminStats = { total: 0, live: 0, review: 0, verified: 0, verificationPending: 0, paymentPending: 0, informationPending: 0, aiGenerating: 0 }

type AdminQueueItem = {
  id: string
  business_name: string
  city: string
  status: string
  updated_at: string
  country?: { name?: string } | null
  business_type_vocabulary?: { name?: string } | null
  business_categories?: { categories?: { name?: string } | null }[]
}

export function AdminDashboard({ theme, onToggleTheme, onSignOut, session }: Props) {
  const [activeFilter, setActiveFilter] = useState('All reviews')
  const [search, setSearch] = useState('')
  const [stats, setStats] = useState<AdminStats>(emptyStats)
  const [queue, setQueue] = useState<AdminQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const load = async () => {
      const client = getSupabaseClient()
      const count = (column?: string, value?: string) => {
        let query = client.from('businesses').select('*', { count: 'exact', head: true })
        if (column && value) query = query.eq(column, value)
        return query
      }
      const [total, live, review, verified, verificationPending, paymentPending, informationPending, aiGenerating, queueResult] = await Promise.all([
        count(),
        count('status', 'LIVE'),
        count('status', 'QUALITY_REVIEW'),
        count('verification_status', 'VERIFIED'),
        count('verification_status', 'PENDING'),
        count('payment_status', 'PENDING'),
        count('status', 'INFORMATION_PENDING'),
        count('status', 'AI_PAGE_GENERATING'),
        client.from('businesses').select('id, business_name, city, status, updated_at, country:countries(name), business_type_vocabulary(name), business_categories(categories(name))').order('updated_at', { ascending: false }).limit(40),
      ])
      if (!isCurrent) return
      if (total.error) setError(total.error.message)
      setStats({
        total: total.count || 0,
        live: live.count || 0,
        review: review.count || 0,
        verified: verified.count || 0,
        verificationPending: verificationPending.count || 0,
        paymentPending: paymentPending.count || 0,
        informationPending: informationPending.count || 0,
        aiGenerating: aiGenerating.count || 0,
      })
      setQueue((queueResult.data || []) as AdminQueueItem[])
      setLoading(false)
    }
    void load()
    return () => { isCurrent = false }
  }, [])

  const visibleQueue = queue.filter((business) => {
    const textMatch = `${business.business_name} ${business.city} ${business.country?.name || ''}`.toLowerCase().includes(search.toLowerCase())
    const statusMatch = activeFilter === 'All reviews'
      ? business.status !== 'LIVE'
      : activeFilter === 'Verification'
        ? business.status.includes('VERIFICATION')
        : activeFilter === 'Page review'
          ? business.status === 'QUALITY_REVIEW'
          : business.status === 'INFORMATION_PENDING'
    return textMatch && statusMatch
  })

  return <Layout active="admin" title="Admin dashboard" theme={theme} onToggleTheme={onToggleTheme} onSignOut={onSignOut} session={session} workspaceName="Business Hub Africa" workspaceSubtitle="Operations" showAdmin>
    <main className="dash-content admin-content">
      <div className="dash-page-heading"><div><div className="page-kicker">BUSINESS HUB AFRICA <i /> OPERATIONS</div><h1>Good morning, BHA team</h1><p>Here is the health of your business network today.</p></div><span className="secondary-button"><CalendarDays size={15} /> Live data</span></div>

      {error && <div className="onboarding-error">{error}</div>}
      {loading && <div className="taxonomy-loading">Loading operations data…</div>}

      <section className="admin-metric-grid">
        <article className="admin-stat"><span>Total businesses <Building2 size={16} /></span><strong>{stats.total}</strong><small><b>{stats.live}</b> currently live</small><div className="stat-bar"><i style={{ width: stats.total ? `${Math.round((stats.live / stats.total) * 100)}%` : '0%' }} /></div></article>
        <article className="admin-stat"><span>Verified businesses <BadgeCheck size={16} /></span><strong>{stats.verified}</strong><small><b>{stats.total ? Math.round((stats.verified / stats.total) * 100) : 0}%</b> of all businesses</small><div className="stat-bar"><i style={{ width: stats.total ? `${Math.round((stats.verified / stats.total) * 100)}%` : '0%' }} /></div></article>
        <article className="admin-stat"><span>Pages awaiting review <Clock3 size={16} /></span><strong>{stats.review}</strong><small><b className="warning-text">{stats.informationPending}</b> need more information</small><div className="stat-bar warning-bar"><i style={{ width: stats.review + stats.informationPending ? `${Math.round((stats.review / (stats.review + stats.informationPending)) * 100)}%` : '0%' }} /></div></article>
        <article className="admin-stat"><span>Live businesses <Globe2 size={16} /></span><strong>{stats.live}</strong><small><b>{stats.aiGenerating}</b> generating pages now</small><div className="stat-bar"><i style={{ width: stats.total ? `${Math.round((stats.live / stats.total) * 100)}%` : '0%' }} /></div></article>
      </section>

      <section className="admin-secondary-metrics">{[['Verification pending', stats.verificationPending], ['Payment pending', stats.paymentPending], ['Information pending', stats.informationPending], ['AI page generation', stats.aiGenerating], ['Quality review', stats.review], ['Live', stats.live]].map(([label, value]) => <article key={String(label)}><span>{label}</span><b>{value}</b><small>Current total</small></article>)}</section>

      <section className="dashboard-panel review-panel">
        <div className="panel-heading"><div><span className="panel-eyebrow">WORK QUEUE <b className="queue-count">{visibleQueue.length}</b></span><h2>Businesses that need a look</h2></div><a className="plain-action" href="/admin#quality-review">Open review panel <ArrowRight size={14} /></a></div>
        <div className="queue-toolbar">
          <div className="filter-tabs">{['All reviews', 'Verification', 'Page review', 'Information'].map((filter) => <button className={activeFilter === filter ? 'selected' : ''} onClick={() => setActiveFilter(filter)} type="button" key={filter}>{filter}</button>)}</div>
          <label className="queue-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search businesses" /></label>
          <button className="filter-button" type="button" aria-label="More filters"><Filter size={15} /></button>
        </div>
        <div className="queue-table">
          <div className="queue-row queue-header"><span>BUSINESS</span><span>LOCATION</span><span>APPLICATION STATUS</span><span>UPDATED</span><span /></div>
          {visibleQueue.map((business) => <a className="queue-row" href="/admin#quality-review" key={business.id}>
            <div className="queue-business"><span className={`queue-avatar avatar-${business.status === 'QUALITY_REVIEW' ? 'orange' : business.status.includes('VERIFICATION') ? 'blue' : 'green'}`}>{initials(business.business_name)}</span><span><b>{business.business_name}</b><small>{business.business_type_vocabulary?.name || business.business_categories?.[0]?.categories?.name || 'Business'}</small></span></div>
            <span className="queue-location"><Globe2 size={13} />{business.city}{business.country?.name ? `, ${business.country.name}` : ''}</span>
            <span className={`status-badge status-${statusTone(business.status)}`}><i />{humanise(business.status)}</span>
            <span className="queue-time">{formatDate(business.updated_at)}</span>
            <span className="row-more"><ArrowRight size={16} /></span>
          </a>)}
          {!loading && visibleQueue.length === 0 && <div className="queue-empty">No businesses match this view.</div>}
        </div>
      </section>

      <section className="admin-bottom-grid">
        <article className="dashboard-panel lifecycle-panel"><div className="panel-heading"><div><span className="panel-eyebrow">BUSINESS LIFECYCLE</span><h2>Where applications stand</h2></div></div><div className="lifecycle-bars">{[
          ['Information pending', stats.informationPending, 'stage-info'],
          ['AI page generation', stats.aiGenerating, 'stage-ai'],
          ['Quality review', stats.review, 'stage-review'],
          ['Live', stats.live, 'stage-verify'],
        ].map(([label, value, tone]) => <div className="lifecycle-item" key={String(label)}><span><i className={`stage-dot ${tone}`} />{label}</span><b>{value}</b><div><i style={{ width: stats.total ? `${Math.min(100, Math.round((Number(value) / stats.total) * 100))}%` : '0%' }} /></div></div>)}</div></article>
        <article className="dashboard-panel admin-tools"><div className="panel-heading"><div><span className="panel-eyebrow">QUICK ACCESS</span><h2>Operations tools</h2></div></div><a href="/admin#taxonomy"><span><Settings size={16} /></span><div><b>Manage taxonomy</b><small>Categories, filters, business types</small></div><ArrowRight size={15} /></a><a href="/admin#quality-review"><span><Check size={16} /></span><div><b>Review pages</b><small>Approve, request changes, verify</small></div><ArrowRight size={15} /></a><a href="/admin#analytics"><span><Activity size={16} /></span><div><b>Analytics</b><small>Search and category insights</small></div><ArrowRight size={15} /></a></article>
      </section>

      <section id="taxonomy" className="dashboard-panel taxonomy-panel">
        <div className="panel-heading"><div><span className="panel-eyebrow">TAXONOMY FOUNDATION <i /> PHASE 1</span><h2>Category & Subcategory Management</h2></div></div>
        <TaxonomyManager />
      </section>

      <section id="quality-review" className="dashboard-panel review-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">QUALITY REVIEW <i /> PHASE 3</span><h2>Page Review & Approval</h2></div></div>
        <QualityReviewPanel />
      </section>

      <section id="analytics" className="dashboard-panel analytics-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">ANALYTICS <i /> PHASE 5</span><h2>Search & Category Insights</h2></div></div>
        <AnalyticsDashboard />
      </section>

      <section id="feedback" className="dashboard-panel feedback-panel-section">
        <div className="panel-heading"><div><span className="panel-eyebrow">GOVERNANCE <i /> PHASE 5</span><h2>Taxonomy Feedback</h2></div></div>
        <TaxonomyFeedbackPanel />
      </section>
      <div className="dashboard-footnote"><ShieldCheck size={14} /> All verification, payment, and publication decisions are recorded in the BHA audit log.</div>
    </main>
  </Layout>
}
